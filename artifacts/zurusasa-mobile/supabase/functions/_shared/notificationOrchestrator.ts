/// <reference path="../deno.d.ts" />
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  chunkArray,
  computeNextRetryIso,
  evaluateChannelEligibility,
  resolvePolicy,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationSettingsMap,
} from './notificationPolicy.ts';
import { renderNotificationTemplate } from './templates/index.ts';
import { formatToE164, maskPhoneForLogs } from './sms/phone.ts';
import { sanitizeSmsText } from './sms/gsm7.ts';
import { getSmsProviderAdapter, sendSmsViaGateway } from './sms/smsGateway.ts';

export interface EnqueueEventParams {
  userId: string;
  type: string;
  templateKey?: string;
  title: string;
  message: string;
  dedupeKey: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  actionType?: string | null;
  actionId?: string | null;
  imageUrl?: string | null;
  payload?: Record<string, unknown>;
  senderId?: string | null;
}

export interface DeliveryRow {
  id: string;
  notification_id: string | null;
  user_id: string;
  channel: NotificationChannel;
  template_key: string;
  priority: NotificationPriority;
  dedupe_key: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
  max_attempts: number;
  expo_ticket_id?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  tracking_id?: string | null;
  last_error?: string | null;
}

interface RecipientContext {
  email: string | null;
  phone: string | null;
  fullName: string;
  timezone: string;
  masterEnabled: boolean;
  marketingOptIn: boolean;
  settings: NotificationSettingsMap;
}

/**
 * Triggers a non-blocking fast-path kick to `process-notification-queue` so critical
 * host/guest booking alerts dispatch in ~2-3s rather than waiting up to 60s for pg_cron.
 * Safe against races because `claim_notification_deliveries` uses `FOR UPDATE SKIP LOCKED`.
 */
export function kickNotificationQueueAsync(): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const cronSecret = Deno.env.get('CRON_SECRET')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || (!cronSecret && !serviceRoleKey)) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cronSecret) {
    headers['x-cron-secret'] = cronSecret;
  } else if (serviceRoleKey) {
    headers['Authorization'] = `Bearer ${serviceRoleKey}`;
  }

  const task = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/process-notification-queue`, {
        method: 'POST',
        headers,
        body: '{}',
        signal: controller.signal,
      });
    } catch {
      // Non-fatal: pg_cron (* * * * *) remains the guaranteed fallback sweep
    } finally {
      clearTimeout(timer);
    }
  })();

  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === 'function') {
    edgeRuntime.waitUntil(task);
  }
}

/**
 * Enqueues a canonical notification event into public.notifications + public.notification_deliveries
 * via the idempotent enqueue_notification_event SQL RPC (with graceful fallback if RPC isn't yet applied).
 */
export async function enqueueNotificationEvent(
  admin: SupabaseClient,
  params: EnqueueEventParams,
): Promise<{ notificationId: string | null; queued: boolean }> {
  const policy = resolvePolicy(params.templateKey || params.type);
  const priority = params.priority || policy.priority;
  const channels = params.channels && params.channels.length > 0 ? params.channels : policy.defaultChannels;
  const templateKey = params.templateKey || params.type;

  const { data: rpcId, error: rpcError } = await admin.rpc('enqueue_notification_event', {
    p_user_id: params.userId,
    p_type: params.type,
    p_template_key: templateKey,
    p_title: params.title,
    p_message: params.message,
    p_dedupe_key: params.dedupeKey,
    p_priority: priority,
    p_channels: channels,
    p_action_type: params.actionType ?? null,
    p_action_id: params.actionId ?? null,
    p_image_url: params.imageUrl ?? null,
    p_payload: params.payload ?? {},
    p_sender_id: params.senderId ?? null,
  });

  if (!rpcError) {
    return { notificationId: rpcId ? String(rpcId) : null, queued: true };
  }

  console.warn('[NotificationOrchestrator] enqueue_notification_event RPC fallback:', rpcError.message);

  // Fallback for environments where migration 202611210001 has not yet been applied
  let notificationId: string | null = null;
  if (channels.includes('in_app')) {
    const { data: inserted } = await admin
      .from('notifications')
      .insert({
        user_id: params.userId,
        sender_id: params.senderId ?? null,
        type: params.type,
        title: params.title,
        message: params.message,
        image_url: params.imageUrl ?? null,
        action_type: params.actionType ?? null,
        action_id: params.actionId ?? null,
        metadata: params.payload ?? {},
        is_read: false,
      })
      .select('id')
      .maybeSingle();
    notificationId = inserted?.id ? String(inserted.id) : null;
  }

  return { notificationId, queued: false };
}

async function resolveRecipientContext(
  admin: SupabaseClient,
  userId: string,
): Promise<RecipientContext> {
  const { data: profile } = await admin
    .from('profiles')
    .select('email, phone, full_name, metadata, notification_settings, timezone, marketing_opt_in')
    .eq('id', userId)
    .maybeSingle();

  let email =
    typeof profile?.email === 'string' && profile.email.includes('@')
      ? profile.email.trim()
      : null;
  let phone =
    typeof profile?.phone === 'string' && profile.phone.trim()
      ? profile.phone.trim()
      : null;

  if (!email || !phone) {
    try {
      const { data: authRes } = await admin.auth.admin.getUserById(userId);
      if (!email && authRes?.user?.email && authRes.user.email.includes('@')) {
        email = authRes.user.email.trim();
      }
      if (!phone && authRes?.user?.phone && authRes.user.phone.trim()) {
        phone = authRes.user.phone.trim();
      }
    } catch {
      // ignore
    }
  }

  const meta = (profile?.metadata ?? {}) as Record<string, unknown>;
  const settings = (profile?.notification_settings ?? {}) as NotificationSettingsMap;

  return {
    email,
    phone,
    fullName: (typeof profile?.full_name === 'string' && profile.full_name.trim()) || 'Traveler',
    timezone:
      (typeof profile?.timezone === 'string' && profile.timezone.trim()) || 'Africa/Nairobi',
    masterEnabled: meta.notifications_enabled !== false,
    marketingOptIn: profile?.marketing_opt_in === true,
    settings,
  };
}

async function markDeliveryRetryOrDeadLetter(
  admin: SupabaseClient,
  delivery: DeliveryRow,
  errorMessage: string,
  retryable: boolean,
) {
  const nextAttempts = (delivery.attempt_count || 0) + 1;
  const maxAttempts = delivery.max_attempts || 5;
  const exhausted = !retryable || nextAttempts >= maxAttempts;

  await admin
    .from('notification_deliveries')
    .update({
      status: exhausted ? 'dead_letter' : 'failed',
      attempt_count: nextAttempts,
      next_retry_at: exhausted ? new Date().toISOString() : computeNextRetryIso(nextAttempts),
      last_error: errorMessage.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id);
}

/**
 * Processes a batch of claimed pending/failed notification_deliveries across push & email.
 */
export async function processClaimedDeliveries(
  admin: SupabaseClient,
  deliveries: DeliveryRow[],
): Promise<{ sent: number; skipped: number; failed: number }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')?.trim() || '';
  const fromAddress =
    Deno.env.get('RESEND_FROM_EMAIL')?.trim() ||
    Deno.env.get('EMAIL_FROM')?.trim() ||
    'ZuruSasa <onboarding@resend.dev>';

  const recipientCache = new Map<string, RecipientContext>();
  const uniqueUserIds = Array.from(new Set(deliveries.map((d) => d.user_id).filter(Boolean)));
  const pushUserIds = Array.from(
    new Set(deliveries.filter((d) => d.channel === 'push').map((d) => d.user_id).filter(Boolean)),
  );

  // Batch pre-fetch all recipient profiles & active push devices in 2 queries (eliminates N+1)
  const [profilesRes, devicesRes] = await Promise.all([
    uniqueUserIds.length > 0
      ? admin
          .from('profiles')
          .select('id, email, phone, full_name, metadata, notification_settings, timezone, marketing_opt_in')
          .in('id', uniqueUserIds)
      : Promise.resolve({ data: [] as any[] }),
    pushUserIds.length > 0
      ? admin
          .from('user_devices')
          .select('user_id, push_token, device_token')
          .in('user_id', pushUserIds)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  for (const profile of (profilesRes.data ?? []) as any[]) {
    const email =
      typeof profile?.email === 'string' && profile.email.includes('@')
        ? profile.email.trim()
        : null;
    const phone =
      typeof profile?.phone === 'string' && profile.phone.trim()
        ? profile.phone.trim()
        : null;
    const meta = (profile?.metadata ?? {}) as Record<string, unknown>;
    const settings = (profile?.notification_settings ?? {}) as NotificationSettingsMap;
    recipientCache.set(String(profile.id), {
      email,
      phone,
      fullName: (typeof profile?.full_name === 'string' && profile.full_name.trim()) || 'Traveler',
      timezone:
        (typeof profile?.timezone === 'string' && profile.timezone.trim()) || 'Africa/Nairobi',
      masterEnabled: meta.notifications_enabled !== false,
      marketingOptIn: profile?.marketing_opt_in === true,
      settings,
    });
  }

  const deviceTokensByUser = new Map<string, string[]>();
  for (const d of (devicesRes.data ?? []) as Array<{
    user_id: string;
    push_token?: string | null;
    device_token?: string | null;
  }>) {
    const uid = String(d.user_id);
    const raw = (d.push_token || d.device_token || '').trim();
    if (!raw) continue;
    let list = deviceTokensByUser.get(uid);
    if (!list) {
      list = [];
      deviceTokensByUser.set(uid, list);
    }
    if (!list.includes(raw)) {
      list.push(raw);
    }
  }

  const authFallbackChecked = new Set<string>();
  const getRecipient = async (
    uid: string,
    needEmailFallback: boolean,
    needPhoneFallback: boolean,
  ): Promise<RecipientContext> => {
    let ctx = recipientCache.get(uid);
    if (!ctx) {
      ctx = {
        email: null,
        phone: null,
        fullName: 'Traveler',
        timezone: 'Africa/Nairobi',
        masterEnabled: true,
        marketingOptIn: false,
        settings: {},
      };
      recipientCache.set(uid, ctx);
    }
    if (((needEmailFallback && !ctx.email) || (needPhoneFallback && !ctx.phone)) && !authFallbackChecked.has(uid)) {
      authFallbackChecked.add(uid);
      try {
        const { data: authRes } = await admin.auth.admin.getUserById(uid);
        if (!ctx.email && authRes?.user?.email && authRes.user.email.includes('@')) {
          ctx.email = authRes.user.email.trim();
        }
        if (!ctx.phone && authRes?.user?.phone && authRes.user.phone.trim()) {
          ctx.phone = authRes.user.phone.trim();
        }
      } catch {
        // ignore
      }
    }
    return ctx;
  };

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Group skipped deliveries by reason so we execute 1 bulk UPDATE per distinct reason
  const skippedByReason = new Map<string, string[]>();
  const queueSkip = (id: string, reason: string) => {
    let bucket = skippedByReason.get(reason);
    if (!bucket) {
      bucket = [];
      skippedByReason.set(reason, bucket);
    }
    bucket.push(id);
    skipped++;
  };

  // Separate push items so we can chunk them into <=100 message Expo API requests
  const pushQueue: Array<{
    delivery: DeliveryRow;
    tokens: string[];
    title: string;
    body: string;
    data: Record<string, unknown>;
  }> = [];

  // Collect deliveries that failed due to missing RESEND_API_KEY so we flush them in parallel
  const unconfiguredEmailDeliveries: DeliveryRow[] = [];

  for (const delivery of deliveries) {
    const recipient = await getRecipient(
      delivery.user_id,
      delivery.channel === 'email' && Boolean(resendApiKey),
      delivery.channel === 'sms',
    );
    const policy = resolvePolicy(delivery.template_key);
    const eligibility = evaluateChannelEligibility({
      priority: delivery.priority || policy.priority,
      category: policy.category,
      channel: delivery.channel,
      masterEnabled: recipient.masterEnabled,
      settings: recipient.settings,
      marketingOptIn: recipient.marketingOptIn,
    });

    if (!eligibility.allowed) {
      queueSkip(delivery.id, eligibility.reason || 'disabled_by_preferences');
      continue;
    }

    if (delivery.channel === 'email' && !resendApiKey) {
      unconfiguredEmailDeliveries.push(delivery);
      failed++;
      continue;
    }

    const enrichedPayload: Record<string, unknown> = {
      ...delivery.payload,
      recipient_name: delivery.payload.recipient_name || recipient.fullName,
      timezone: delivery.payload.timezone || recipient.timezone,
    };

    const rendered = renderNotificationTemplate(delivery.template_key, enrichedPayload);

    if (delivery.channel === 'email') {
      if (!recipient.email) {
        queueSkip(delivery.id, 'no_recipient_email');
        continue;
      }

      try {
        const headers: Record<string, string> = {};
        if (rendered.priority === 'promotional') {
          headers['List-Unsubscribe'] = '<https://zurusasa.com/profile/notifications>';
        }

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [recipient.email],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
          }),
        });

        const resJson = await res.json().catch(() => ({}));
        if (!res.ok) {
          const retryable = res.status === 429 || res.status >= 500;
          await markDeliveryRetryOrDeadLetter(
            admin,
            delivery,
            `Resend HTTP ${res.status}: ${resJson?.message || res.statusText}`,
            retryable,
          );
          failed++;
          continue;
        }

        await admin
          .from('notification_deliveries')
          .update({
            status: 'sent',
            provider: 'resend',
            provider_message_id: resJson?.id ? String(resJson.id) : null,
            attempt_count: (delivery.attempt_count || 0) + 1,
            sent_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
        sent++;
      } catch (err: any) {
        await markDeliveryRetryOrDeadLetter(admin, delivery, err?.message || 'Resend network error', true);
        failed++;
      }
    } else if (delivery.channel === 'push') {
      const tokens = deviceTokensByUser.get(delivery.user_id) ?? [];

      if (tokens.length === 0) {
        queueSkip(delivery.id, 'no_active_devices');
        continue;
      }

      pushQueue.push({
        delivery,
        tokens,
        title: rendered.pushTitle,
        body: rendered.pushBody,
        data: {
          notificationId: delivery.notification_id,
          type: String(enrichedPayload.type || delivery.template_key),
          actionType: String(enrichedPayload.action_type || rendered.actionType),
          actionId: enrichedPayload.action_id ? String(enrichedPayload.action_id) : undefined,
          bookingId: enrichedPayload.booking_id ? String(enrichedPayload.booking_id) : undefined,
          conversationId: enrichedPayload.conversation_id ? String(enrichedPayload.conversation_id) : undefined,
        },
      });
    } else if (delivery.channel === 'sms') {
      const phoneCheck = formatToE164(recipient.phone);
      if (!phoneCheck.valid) {
        queueSkip(delivery.id, 'no_valid_phone');
        continue;
      }

      const trackingId = delivery.tracking_id || delivery.id;

      // Reconcile-before-retry guard for Mobile Sasa:
      // If a previous attempt crashed/timed out after sending, check /v1/dlr before re-posting to prevent duplicate SMS.
      if (
        delivery.tracking_id &&
        (delivery.attempt_count > 0 || (delivery.last_error || '').includes('Recovered from stale'))
      ) {
        const msAdapter = getSmsProviderAdapter('mobilesasa');
        if (msAdapter.isConfigured() && msAdapter.lookupDlr) {
          const dlr = await msAdapter.lookupDlr({
            trackingId,
            messageId: delivery.provider_message_id || undefined,
          });
          if (dlr.found && (dlr.normalizedStatus === 'delivered' || dlr.normalizedStatus === 'sent')) {
            const nowIso = new Date().toISOString();
            await admin
              .from('notification_deliveries')
              .update({
                status: dlr.normalizedStatus === 'delivered' ? 'delivered' : 'sent',
                provider: 'mobilesasa',
                provider_message_id: dlr.providerMessageId || delivery.provider_message_id || null,
                dlr_status: dlr.rawStatus || dlr.normalizedStatus,
                dlr_received_at: dlr.normalizedStatus === 'delivered' ? nowIso : null,
                provider_response: dlr.rawResponse ?? null,
                sent_at: nowIso,
                last_error: null,
                updated_at: nowIso,
              })
              .eq('id', delivery.id);
            sent++;
            continue;
          }
        }
      }

      // Persist tracking_id prior to outbound HTTP call so any mid-request crash is reconcilable
      if (!delivery.tracking_id) {
        await admin
          .from('notification_deliveries')
          .update({ tracking_id: trackingId, updated_at: new Date().toISOString() })
          .eq('id', delivery.id);
      }

      const smsText = sanitizeSmsText(rendered.smsBody || rendered.pushBody || rendered.pushTitle, 160);
      const smsRes = await sendSmsViaGateway({
        toE164: phoneCheck.e164,
        text: smsText,
        trackingId,
      });

      if (smsRes.accepted) {
        const nowIso = new Date().toISOString();
        await admin
          .from('notification_deliveries')
          .update({
            status: 'sent', // Accepted by provider gateway; handset delivery confirmed via DLR webhook
            provider: smsRes.provider,
            provider_message_id: smsRes.providerMessageId ?? null,
            tracking_id: trackingId,
            provider_cost: smsRes.costParts ?? null,
            provider_response: smsRes.rawResponse ?? null,
            attempt_count: (delivery.attempt_count || 0) + 1,
            sent_at: nowIso,
            last_error: smsRes.usedFallback && smsRes.primaryError
              ? `Failover from ${smsRes.primaryError}`.slice(0, 500)
              : null,
            updated_at: nowIso,
          })
          .eq('id', delivery.id);
        sent++;
      } else if (smsRes.errorKind === 'disabled') {
        queueSkip(delivery.id, 'sms_globally_disabled');
      } else if (smsRes.errorKind === 'duplicate_blocked') {
        queueSkip(delivery.id, `mobilesasa_duplicate_blocked:${smsRes.rawStatus || '0409'}`);
      } else {
        const errMsg = `[${smsRes.provider}] ${smsRes.error || 'SMS send failed'} (${maskPhoneForLogs(phoneCheck.e164)})`;
        const retryable = smsRes.errorKind === 'retryable' || smsRes.errorKind === 'unconfigured';
        await markDeliveryRetryOrDeadLetter(admin, delivery, errMsg, retryable);
        failed++;
      }
    } else {
      queueSkip(delivery.id, `unsupported_worker_channel:${delivery.channel}`);
    }
  }

  // Flush bulk skip updates and unconfigured-email retries in parallel
  const flushTasks: PromiseLike<unknown>[] = [];
  if (skippedByReason.size > 0) {
    const nowIso = new Date().toISOString();
    for (const [reason, ids] of skippedByReason.entries()) {
      flushTasks.push(
        admin
          .from('notification_deliveries')
          .update({
            status: 'skipped',
            last_error: reason,
            updated_at: nowIso,
          })
          .in('id', ids),
      );
    }
  }
  if (unconfiguredEmailDeliveries.length > 0) {
    const nowIso = new Date().toISOString();
    const deadIds: string[] = [];
    const retryGroups = new Map<number, string[]>();
    for (const d of unconfiguredEmailDeliveries) {
      const nextAttempts = (d.attempt_count || 0) + 1;
      const maxAttempts = d.max_attempts || 5;
      if (nextAttempts >= maxAttempts) {
        deadIds.push(d.id);
      } else {
        const list = retryGroups.get(nextAttempts) || [];
        list.push(d.id);
        retryGroups.set(nextAttempts, list);
      }
    }
    if (deadIds.length > 0) {
      flushTasks.push(
        admin
          .from('notification_deliveries')
          .update({
            status: 'dead_letter',
            last_error: 'RESEND_API_KEY not configured',
            updated_at: nowIso,
          })
          .in('id', deadIds),
      );
    }
    for (const [nextAttempts, ids] of retryGroups.entries()) {
      flushTasks.push(
        admin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            attempt_count: nextAttempts,
            next_retry_at: computeNextRetryIso(nextAttempts),
            last_error: 'RESEND_API_KEY not configured',
            updated_at: nowIso,
          })
          .in('id', ids),
      );
    }
  }
  if (flushTasks.length > 0) {
    await Promise.all(flushTasks);
  }

  // Flatten and chunk Expo push messages to <= 100 per API call
  interface FlatPushItem {
    delivery: DeliveryRow;
    token: string;
    message: Record<string, unknown>;
  }
  const flatItems: FlatPushItem[] = [];
  for (const item of pushQueue) {
    for (const token of item.tokens) {
      flatItems.push({
        delivery: item.delivery,
        token,
        message: {
          to: token,
          sound: 'default',
          title: item.title,
          body: item.body,
          data: item.data,
          channelId: 'default',
          priority: 'high',
          badge: 1,
        },
      });
    }
  }

  const deliveryOutcomes = new Map<
    string,
    { okTicketId: string | null; errors: string[]; retryable: boolean; delivery: DeliveryRow }
  >();
  for (const item of pushQueue) {
    deliveryOutcomes.set(item.delivery.id, {
      okTicketId: null,
      errors: [],
      retryable: false,
      delivery: item.delivery,
    });
  }

  for (const chunk of chunkArray(flatItems, 100)) {
    try {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk.map((c) => c.message)),
      });

      const expoJson = await expoRes.json().catch(() => ({}));
      if (!expoRes.ok) {
        const retryable = expoRes.status === 429 || expoRes.status >= 500;
        for (const entry of chunk) {
          const out = deliveryOutcomes.get(entry.delivery.id)!;
          out.errors.push(`Expo HTTP ${expoRes.status}`);
          out.retryable = out.retryable || retryable;
        }
        continue;
      }

      const tickets: any[] = Array.isArray(expoJson?.data)
        ? expoJson.data
        : expoJson?.data
          ? [expoJson.data]
          : [];

      for (let i = 0; i < chunk.length; i++) {
        const entry = chunk[i];
        const ticket = tickets[i];
        const out = deliveryOutcomes.get(entry.delivery.id)!;

        if (ticket?.status === 'ok') {
          if (!out.okTicketId && ticket.id) {
            out.okTicketId = String(ticket.id);
          } else if (!out.okTicketId) {
            out.okTicketId = 'ok';
          }
        } else {
          const errCode = String(ticket?.details?.error || ticket?.message || 'expo_ticket_error');
          out.errors.push(errCode);
          if (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials') {
            await admin
              .from('user_devices')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('user_id', entry.delivery.user_id)
              .or(`push_token.eq.${entry.token},device_token.eq.${entry.token}`);
          } else {
            out.retryable = true;
          }
        }
      }
    } catch (err: any) {
      for (const entry of chunk) {
        const out = deliveryOutcomes.get(entry.delivery.id)!;
        out.errors.push(err?.message || 'expo_network_error');
        out.retryable = true;
      }
    }
  }

  for (const out of deliveryOutcomes.values()) {
    if (out.okTicketId) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'sent',
          provider: 'expo',
          expo_ticket_id: out.okTicketId === 'ok' ? null : out.okTicketId,
          attempt_count: (out.delivery.attempt_count || 0) + 1,
          sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', out.delivery.id);
      sent++;
    } else {
      await markDeliveryRetryOrDeadLetter(
        admin,
        out.delivery,
        out.errors.join('; ') || 'push_failed',
        out.retryable,
      );
      failed++;
    }
  }

  return { sent, skipped, failed };
}

/**
 * Polls Expo Push Receipts API for push deliveries sent at least 15 minutes ago
 * and marks them delivered / failed (deactivating DeviceNotRegistered tokens).
 */
export async function pollExpoPushReceipts(
  admin: SupabaseClient,
): Promise<{ checked: number; delivered: number; failed: number }> {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: pendingReceipts } = await admin
    .from('notification_deliveries')
    .select('id, user_id, expo_ticket_id')
    .eq('channel', 'push')
    .eq('status', 'sent')
    .not('expo_ticket_id', 'is', null)
    .is('receipt_checked_at', null)
    .lte('sent_at', fifteenMinsAgo)
    .limit(100);

  if (!pendingReceipts || pendingReceipts.length === 0) {
    return { checked: 0, delivered: 0, failed: 0 };
  }

  const ticketIds = pendingReceipts
    .map((r: any) => String(r.expo_ticket_id))
    .filter(Boolean);

  let delivered = 0;
  let failed = 0;

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });

    const json = await res.json().catch(() => ({}));
    const receiptMap = (json?.data ?? {}) as Record<string, any>;
    const nowIso = new Date().toISOString();

    for (const row of pendingReceipts as Array<{ id: string; user_id: string; expo_ticket_id: string }>) {
      const receipt = receiptMap[row.expo_ticket_id];
      if (!receipt) {
        // Receipt not ready yet; mark checked only if older than 24h
        continue;
      }

      if (receipt.status === 'ok') {
        await admin
          .from('notification_deliveries')
          .update({
            status: 'delivered',
            receipt_checked_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', row.id);
        delivered++;
      } else {
        const errCode = String(receipt?.details?.error || receipt?.message || 'expo_receipt_error');
        await admin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            receipt_checked_at: nowIso,
            last_error: errCode,
            updated_at: nowIso,
          })
          .eq('id', row.id);
        if (errCode === 'DeviceNotRegistered') {
          const badToken = receipt?.details?.expoPushToken;
          if (typeof badToken === 'string' && badToken.trim()) {
            await admin
              .from('user_devices')
              .update({ is_active: false, updated_at: nowIso })
              .eq('user_id', row.user_id)
              .or(`push_token.eq.${badToken},device_token.eq.${badToken}`);
          }
        }
        failed++;
      }
    }
  } catch (err) {
    console.warn('[NotificationOrchestrator] Expo receipt poll warning:', err);
  }

  return { checked: pendingReceipts.length, delivered, failed };
}
