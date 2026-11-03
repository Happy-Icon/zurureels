/// <reference path="../deno.d.ts" />
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVILEGED_ONLY_TYPES = new Set([
  'payment_success',
  'payout_completed',
  'refund_processed',
  'verification',
]);
const SOCIAL_TYPES = new Set([
  'like',
  'comment',
  'follow',
  'wishlist_available',
  'listing_inquiry',
  'review_received',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function formatToE164(rawPhone: string, defaultCountryCode = '254'): { valid: boolean; e164: string; error?: string } {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, e164: '', error: 'No phone number provided' };
  }
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) {
    return { valid: false, e164: '', error: 'Phone number contains no numeric digits' };
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = `+${defaultCountryCode}${cleaned.slice(1)}`;
  } else if (!cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return { valid: false, e164: cleaned, error: 'Phone number is not valid E.164 format' };
  }
  return { valid: true, e164: cleaned };
}

function resolveNotificationCategory(notifType?: string): string | null {
  if (!notifType) return null;
  if (notifType === 'message') return 'messages';
  if (
    notifType.startsWith('booking_') ||
    notifType.startsWith('payment_') ||
    notifType.startsWith('payout_') ||
    notifType.startsWith('refund_') ||
    notifType === 'account_activity'
  ) {
    return 'account_activity';
  }
  if (notifType.startsWith('listing_') || notifType === 'verification') {
    return 'listing_activity';
  }
  if (notifType === 'review_reminder') return 'reminders';
  if (notifType === 'promotion' || notifType === 'wishlist_available') return 'all_offers';
  return null;
}

async function verifyCallerRecipientRelationship(
  admin: SupabaseClient,
  callerId: string,
  recipientId: string,
  notifType: string,
  actionId: string | null,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin || callerId === recipientId) return true;

  // 1. Shared conversation
  const { data: conv } = await admin
    .from('conversations')
    .select('id')
    .or(
      `and(participant_one.eq.${callerId},participant_two.eq.${recipientId}),and(participant_one.eq.${recipientId},participant_two.eq.${callerId})`,
    )
    .limit(1)
    .maybeSingle();
  if (conv?.id) return true;

  // 2. Shared booking (caller is guest & recipient is host, or caller is host & recipient is guest)
  const { data: guestBookings } = await admin
    .from('bookings')
    .select('id, experience:experiences!inner(user_id)')
    .eq('user_id', callerId)
    .eq('experiences.user_id', recipientId)
    .limit(1);
  if (guestBookings && guestBookings.length > 0) return true;

  const { data: hostBookings } = await admin
    .from('bookings')
    .select('id, experience:experiences!inner(user_id)')
    .eq('user_id', recipientId)
    .eq('experiences.user_id', callerId)
    .limit(1);
  if (hostBookings && hostBookings.length > 0) return true;

  // 3. Shared booking quote
  const { data: quote } = await admin
    .from('booking_quotes')
    .select('id')
    .or(
      `and(guest_id.eq.${callerId},host_id.eq.${recipientId}),and(guest_id.eq.${recipientId},host_id.eq.${callerId})`,
    )
    .limit(1)
    .maybeSingle();
  if (quote?.id) return true;

  // 4. Social interactions (follow, like, comment, listing inquiry)
  if (SOCIAL_TYPES.has(notifType)) {
    if (notifType === 'follow') {
      const { data: followRow } = await admin
        .from('follows')
        .select('id')
        .eq('follower_id', callerId)
        .eq('following_id', recipientId)
        .limit(1)
        .maybeSingle();
      if (followRow?.id) return true;
    }

    if (actionId && UUID_RE.test(actionId)) {
      const { data: reel } = await admin
        .from('reels')
        .select('id')
        .eq('id', actionId)
        .eq('user_id', recipientId)
        .maybeSingle();
      if (reel?.id) return true;

      const { data: exp } = await admin
        .from('experiences')
        .select('id')
        .eq('id', actionId)
        .eq('user_id', recipientId)
        .maybeSingle();
      if (exp?.id) return true;
    }

    const { data: recipientContent } = await admin
      .from('reels')
      .select('id')
      .eq('user_id', recipientId)
      .limit(1)
      .maybeSingle();
    if (recipientContent?.id) return true;
  }

  return false;
}

async function dispatchAfricasTalkingSms(
  phoneE164: string,
  message: string,
): Promise<{
  sent: boolean;
  provider: string;
  httpStatus?: number;
  messageId?: string | null;
  status?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('AFRICASTALKING_API_KEY');
  const username = Deno.env.get('AFRICASTALKING_USERNAME');
  const senderId = Deno.env.get('AFRICASTALKING_SENDER_ID');

  if (!apiKey || !username) {
    return {
      sent: false,
      provider: 'unconfigured',
      error: 'SMS gateway is not configured on server',
    };
  }

  const endpoint =
    username.trim().toLowerCase() === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

  const form = new URLSearchParams();
  form.set('username', username.trim());
  form.set('to', phoneE164);
  form.set('message', message);
  if (senderId && senderId.trim().length > 0) {
    form.set('from', senderId.trim());
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      apiKey: apiKey.trim(),
    },
    body: form.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  const recipients = payload?.SMSMessageData?.Recipients;
  const firstRecipient = Array.isArray(recipients) ? recipients[0] : null;
  const statusCode = Number(firstRecipient?.statusCode ?? 0);
  const statusText = String(firstRecipient?.status || payload?.SMSMessageData?.Message || '');

  const isDelivered =
    response.ok &&
    (statusCode === 100 ||
      statusCode === 101 ||
      statusCode === 102 ||
      statusText.toLowerCase() === 'success');

  if (!isDelivered) {
    return {
      sent: false,
      provider: 'AfricasTalking',
      httpStatus: response.status,
      status: statusText || undefined,
      error: statusText || `Africa's Talking HTTP ${response.status}`,
    };
  }

  return {
    sent: true,
    provider: 'AfricasTalking',
    httpStatus: response.status,
    messageId: firstRecipient?.messageId ? String(firstRecipient.messageId) : null,
    status: statusText || 'Success',
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication is required' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return json({ error: 'Authentication is required' }, 401);
  }

  // Rate limit: max 30 notifications dispatched per 60 seconds per authenticated user
  const rl = await checkRateLimit(request, 'dispatch_notif', 30, 60, user.id);
  if (!rl.allowed) {
    return json({ error: 'Too many notification requests. Please slow down.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const recipientId = typeof body.recipientId === 'string' ? body.recipientId.trim() : '';
  if (!UUID_RE.test(recipientId)) {
    return json({ error: 'Valid recipientId UUID is required' }, 400);
  }

  const notifType = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'notification';
  const createInApp = Boolean(body.createInApp);
  const sendPush = body.sendPush !== undefined ? Boolean(body.sendPush) : true;
  const sendSms = Boolean(body.sendSms);

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';

  if (!message) {
    return json({ error: 'message is required' }, 400);
  }
  if ((createInApp || sendPush) && !title) {
    return json({ error: 'title is required for in-app or push notifications' }, 400);
  }

  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  const actionType = typeof body.actionType === 'string' && body.actionType.trim() ? body.actionType.trim() : null;
  const actionId = typeof body.actionId === 'string' && body.actionId.trim() ? body.actionId.trim() : null;
  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};
  const extraPushData =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : {};

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = callerProfile?.role === 'admin';

  if (!isAdmin && PRIVILEGED_ONLY_TYPES.has(notifType)) {
    return json({ error: `Notification type "${notifType}" is restricted to server workflows` }, 403);
  }

  const isRelated = await verifyCallerRecipientRelationship(
    admin,
    user.id,
    recipientId,
    notifType,
    actionId,
    isAdmin,
  );
  if (!isRelated) {
    return json({ error: 'Not authorized to dispatch notifications to this recipient' }, 403);
  }

  const { data: recipientProfile } = await admin
    .from('profiles')
    .select('phone, metadata, notification_settings')
    .eq('id', recipientId)
    .maybeSingle();

  const notifMeta = ((recipientProfile?.metadata ?? {}) as Record<string, unknown>);
  const masterEnabled = notifMeta.notifications_enabled !== false;
  const settings = ((recipientProfile?.notification_settings ?? {}) as Record<
    string,
    { push?: boolean; email?: boolean; sms?: boolean }
  >);
  const categoryKey = resolveNotificationCategory(notifType);

  let insertedNotification: Record<string, unknown> | null = null;

  // 1. Optional In-App Notification Record
  if (createInApp) {
    const mergedMetadata: Record<string, unknown> = {
      ...metadata,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(actionType ? { action_type: actionType } : {}),
      ...(actionId ? { action_id: actionId } : {}),
    };

    const { data: notifRow, error: notifErr } = await admin
      .from('notifications')
      .insert({
        user_id: recipientId,
        sender_id: user.id,
        type: notifType,
        title,
        message,
        image_url: imageUrl,
        action_type: actionType,
        action_id: actionId,
        metadata: mergedMetadata,
        is_read: false,
      })
      .select('id, user_id, type, title, message, image_url, action_type, action_id, is_read, created_at')
      .single();

    if (notifErr) {
      console.error('[DispatchNotification] Failed to insert in-app notification:', notifErr.message);
    } else {
      insertedNotification = notifRow as Record<string, unknown>;
    }
  }

  // 2. Server-Side Expo Push Dispatch (never leaks device tokens to caller)
  let pushSummary: { dispatched: number; skippedReason?: string } = { dispatched: 0 };
  if (sendPush) {
    const pushAllowedForCategory =
      masterEnabled && !(categoryKey && settings[categoryKey]?.push === false);

    if (!pushAllowedForCategory) {
      pushSummary = { dispatched: 0, skippedReason: 'disabled_by_recipient_preferences' };
    } else {
      const { data: devices, error: devErr } = await admin
        .from('user_devices')
        .select('id, push_token, device_token')
        .eq('user_id', recipientId)
        .eq('is_active', true);

      if (devErr) {
        console.error('[DispatchNotification] user_devices lookup error:', devErr.message);
      }

      const uniqueTokens: string[] = [];
      const seenTokens = new Set<string>();
      for (const d of (devices ?? []) as Array<{ push_token?: string | null; device_token?: string | null }>) {
        const raw = (d.push_token || d.device_token || '').trim();
        if (raw && !seenTokens.has(raw)) {
          seenTokens.add(raw);
          uniqueTokens.push(raw);
        }
      }

      if (uniqueTokens.length === 0) {
        pushSummary = { dispatched: 0, skippedReason: 'no_active_devices' };
      } else {
        const pushMessages = uniqueTokens.map((token) => ({
          to: token,
          sound: 'default',
          title,
          body: message,
          data: {
            type: notifType,
            ...(actionType ? { actionType } : {}),
            ...(actionId ? { actionId } : {}),
            ...extraPushData,
          },
          channelId: 'default',
          priority: 'high',
          badge: 1,
        }));

        try {
          const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pushMessages),
          });

          const expoJson = await expoRes.json().catch(() => ({}));
          const tickets: any[] = Array.isArray(expoJson?.data)
            ? expoJson.data
            : expoJson?.data
              ? [expoJson.data]
              : [];

          let okCount = 0;
          const staleTokens: string[] = [];

          tickets.forEach((ticket, idx) => {
            if (ticket?.status === 'ok') {
              okCount++;
            } else if (
              ticket?.status === 'error' &&
              (ticket?.details?.error === 'DeviceNotRegistered' ||
                ticket?.details?.error === 'InvalidCredentials')
            ) {
              const badToken = uniqueTokens[idx];
              if (badToken) staleTokens.push(badToken);
            }
          });

          for (const staleToken of staleTokens) {
            await admin
              .from('user_devices')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('user_id', recipientId)
              .or(`push_token.eq.${staleToken},device_token.eq.${staleToken}`);
          }

          pushSummary = { dispatched: okCount };
        } catch (pushErr) {
          console.error('[DispatchNotification] Expo push API error:', pushErr);
          pushSummary = { dispatched: 0, skippedReason: 'expo_gateway_error' };
        }
      }
    }
  }

  // 3. Optional Server-Side Africa's Talking SMS Dispatch
  let smsSummary: {
    sent: boolean;
    provider: string;
    httpStatus?: number;
    messageId?: string | null;
    status?: string;
    error?: string;
  } | null = null;

  if (sendSms) {
    const isSelfTestSms = recipientId === user.id && notifType === 'test_sms';
    const smsAllowedForCategory =
      isSelfTestSms || (masterEnabled && !(categoryKey && settings[categoryKey]?.sms === false));

    if (!smsAllowedForCategory) {
      smsSummary = {
        sent: false,
        provider: 'preferences',
        error: 'Recipient has disabled SMS notifications for this category',
      };
    } else {
      // Only allow caller-supplied phone override when sending to self; cross-user SMS resolves strictly from server profile/auth
      let rawTargetPhone = '';
      if (recipientId === user.id && typeof body.recipientPhone === 'string' && body.recipientPhone.trim()) {
        rawTargetPhone = body.recipientPhone.trim();
      } else if (recipientProfile?.phone) {
        rawTargetPhone = String(recipientProfile.phone);
      } else {
        const { data: authTarget } = await admin.auth.admin.getUserById(recipientId);
        rawTargetPhone = authTarget?.user?.phone ?? '';
      }

      const phoneCheck = formatToE164(rawTargetPhone);
      if (!phoneCheck.valid) {
        smsSummary = {
          sent: false,
          provider: 'E164_VALIDATOR',
          error: phoneCheck.error || 'Recipient has no valid E.164 phone number on file',
        };
      } else {
        smsSummary = await dispatchAfricasTalkingSms(phoneCheck.e164, message);
      }
    }
  }

  return json({
    success: true,
    notification: insertedNotification,
    push: pushSummary,
    ...(smsSummary ? { sms: smsSummary } : {}),
  });
});
