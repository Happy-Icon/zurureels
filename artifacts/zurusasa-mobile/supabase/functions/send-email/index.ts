/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import {
  evaluateChannelEligibility,
  resolvePolicy,
  type NotificationSettingsMap,
} from '../_shared/notificationPolicy.ts';
import {
  ALLOWED_CLIENT_EMAIL_TEMPLATES,
  renderNotificationTemplate,
} from '../_shared/templates/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Authentication is required' }, 401);
  }

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

  // Enforce server-side rate limit: max 10 email requests per 60 seconds per user
  const rl = await checkRateLimit(request, 'send_email', 10, 60, user.id);
  if (!rl.allowed) {
    return json({ error: 'Too many email requests. Please wait before trying again.' }, 429);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('[SendEmail] RESEND_API_KEY is not set in Supabase Edge Function secrets');
    return json({ error: 'Email service is not configured' }, 503);
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

  // Authoritative server sender (never trust client-supplied 'from')
  const fromAddress =
    Deno.env.get('RESEND_FROM_EMAIL') ||
    Deno.env.get('EMAIL_FROM') ||
    'ZuruSasa <onboarding@resend.dev>';

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = callerProfile?.role === 'admin';

  const rawTemplateKey =
    typeof body.templateKey === 'string' && body.templateKey.trim()
      ? body.templateKey.trim().toLowerCase()
      : typeof body.type === 'string' && body.type.trim()
        ? body.type.trim().toLowerCase()
        : '';

  // Lock non-admin clients to server-side templates only (prevents raw HTML phishing/spoofing)
  if (!isAdmin && (!rawTemplateKey || !ALLOWED_CLIENT_EMAIL_TEMPLATES.has(rawTemplateKey))) {
    return json(
      {
        error:
          'Raw HTML emails are prohibited. Provide an allowed server-side templateKey.',
      },
      403,
    );
  }

  let targetUserId = '';
  let templatePayload: Record<string, unknown> =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? { ...(body.data as Record<string, unknown>) }
      : {};

  if (rawTemplateKey === 'host_application' || rawTemplateKey === 'host_welcome') {
    targetUserId = user.id;
    templatePayload = {
      ...templatePayload,
      host_name:
        (typeof templatePayload.name === 'string' && templatePayload.name.trim()) ||
        callerProfile?.full_name ||
        'Zuru Host',
    };
  } else {
    const recipientUserId =
      typeof body.recipientUserId === 'string' ? body.recipientUserId.trim() : '';
    const bookingId =
      typeof body.bookingId === 'string'
        ? body.bookingId.trim()
        : typeof templatePayload.booking_id === 'string'
          ? templatePayload.booking_id.trim()
          : '';

    if (recipientUserId) {
      if (!UUID_RE.test(recipientUserId)) {
        return json({ error: 'Invalid recipientUserId UUID' }, 400);
      }

      if (recipientUserId !== user.id && !isAdmin) {
        if (!UUID_RE.test(bookingId)) {
          return json({ error: 'bookingId is required for cross-user transactional emails' }, 403);
        }

        const { data: bookingRow } = await admin
          .from('bookings')
          .select('id, user_id, trip_title, amount, check_in, check_out, experience:experiences!inner(user_id, title, timezone)')
          .eq('id', bookingId)
          .maybeSingle();

        if (!bookingRow) {
          return json({ error: 'Associated booking not found' }, 404);
        }

        const exp = Array.isArray(bookingRow.experience)
          ? bookingRow.experience[0]
          : bookingRow.experience;
        const guestId = String(bookingRow.user_id ?? '');
        const hostId = String((exp as any)?.user_id ?? '');

        const validCounterparty =
          (user.id === hostId && recipientUserId === guestId) ||
          (user.id === guestId && recipientUserId === hostId);

        if (!validCounterparty) {
          return json({ error: 'Not authorized to email this booking participant' }, 403);
        }

        // Enrich template payload with authoritative server-side booking fields
        templatePayload = {
          ...templatePayload,
          booking_id: bookingRow.id,
          trip_title: bookingRow.trip_title || (exp as any)?.title || 'Coastal Stay',
          amount: bookingRow.amount,
          check_in: bookingRow.check_in,
          check_out: bookingRow.check_out,
          timezone: (exp as any)?.timezone || 'Africa/Nairobi',
        };
      }

      targetUserId = recipientUserId;
    } else if (isAdmin && typeof body.to === 'string' && body.to.trim()) {
      targetUserId = user.id;
    } else {
      return json({ error: 'recipientUserId is required' }, 400);
    }
  }

  // Resolve authoritative recipient email & preferences on the server
  const { data: recipientProfile } = await admin
    .from('profiles')
    .select('email, full_name, metadata, notification_settings, timezone, marketing_opt_in')
    .eq('id', targetUserId)
    .maybeSingle();

  const notifMeta = (recipientProfile?.metadata ?? {}) as Record<string, unknown>;
  const notifSettings = (recipientProfile?.notification_settings ?? {}) as NotificationSettingsMap;
  const policy = resolvePolicy(rawTemplateKey || 'account_activity');

  const eligibility = evaluateChannelEligibility({
    priority: policy.priority,
    category: policy.category,
    channel: 'email',
    masterEnabled: notifMeta.notifications_enabled !== false,
    settings: notifSettings,
    marketingOptIn: recipientProfile?.marketing_opt_in === true,
  });

  if (!eligibility.allowed) {
    return json({
      success: true,
      skipped: true,
      reason: eligibility.reason || 'Recipient disabled email notifications',
    });
  }

  let resolvedEmail =
    typeof recipientProfile?.email === 'string' && recipientProfile.email.includes('@')
      ? recipientProfile.email.trim()
      : '';

  if (!resolvedEmail) {
    if (targetUserId === user.id && user.email && user.email.includes('@')) {
      resolvedEmail = user.email.trim();
    } else {
      const { data: authTarget } = await admin.auth.admin.getUserById(targetUserId);
      if (authTarget?.user?.email && authTarget.user.email.includes('@')) {
        resolvedEmail = authTarget.user.email.trim();
      }
    }
  }

  if (!resolvedEmail) {
    return json({ error: 'Recipient does not have a deliverable email address on file' }, 422);
  }

  let subject = '';
  let html = '';
  let text = '';

  if (rawTemplateKey) {
    const rendered = renderNotificationTemplate(rawTemplateKey, {
      ...templatePayload,
      recipient_name:
        templatePayload.recipient_name ||
        recipientProfile?.full_name ||
        'Traveler',
      timezone:
        templatePayload.timezone ||
        recipientProfile?.timezone ||
        'Africa/Nairobi',
    });
    subject = rendered.subject;
    html = rendered.html;
    text = rendered.text;
  } else {
    // Admin-only custom HTML path
    subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 250) : '';
    html = typeof body.html === 'string' ? body.html.trim() : '';
    text = typeof body.text === 'string' ? body.text.trim() : html.replace(/<[^>]+>/g, '');
    if (!subject || !html) {
      return json({ error: 'Missing required fields: subject and html' }, 400);
    }
  }

  try {
    const headers: Record<string, string> = {};
    if (policy.priority === 'promotional') {
      headers['List-Unsubscribe'] = '<https://zurusasa.com/profile/notifications>';
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [resolvedEmail],
        subject,
        html,
        text,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[SendEmail] Resend API error:', data);
      return json(
        { error: data?.message || 'Failed to send email via Resend' },
        response.status,
      );
    }

    console.log(`[SendEmail] Successfully dispatched email (${rawTemplateKey || 'admin'}). Message ID: ${data?.id}`);
    return json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error('[SendEmail] Exception calling Resend API:', err);
    return json({ error: err?.message || 'Internal network error sending email' }, 500);
  }
});
