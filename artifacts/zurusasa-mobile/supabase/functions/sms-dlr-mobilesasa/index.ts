/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeMobileSasaDlrStatus,
  verifyMobileSasaWebhookSignature,
} from '../_shared/sms/providers/mobilesasa.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-mobilesasa-signature, x-mobilesasa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractDlrFields(payload: Record<string, any>) {
  const nested =
    (Array.isArray(payload?.data) ? payload.data[0] : payload?.data) ||
    payload?.dlr ||
    {};

  const trackingId = String(
    payload?.trackingId ??
      payload?.tracking_id ??
      nested?.trackingId ??
      nested?.tracking_id ??
      '',
  ).trim();

  const messageId = String(
    payload?.messageId ??
      payload?.message_id ??
      payload?.reference ??
      nested?.messageId ??
      nested?.message_id ??
      nested?.reference ??
      nested?.id ??
      '',
  ).trim();

  const rawStatus = String(
    payload?.deliveryStatus ??
      payload?.dlrStatus ??
      payload?.dlr_status ??
      nested?.deliveryStatus ??
      nested?.dlrStatus ??
      nested?.dlr_status ??
      nested?.description ??
      (typeof payload?.status === 'string' ? payload.status : '') ??
      (typeof nested?.status === 'string' ? nested.status : '') ??
      payload?.statusText ??
      nested?.status_text ??
      '',
  ).trim();

  const normalizedStatus = normalizeMobileSasaDlrStatus(rawStatus);

  const failureReason = String(
    payload?.failureReason ??
      payload?.failure_reason ??
      nested?.failureReason ??
      nested?.failure_reason ??
      (normalizedStatus === 'failed' ? nested?.description ?? '' : '') ??
      payload?.error ??
      payload?.reason ??
      '',
  ).trim();

  return {
    trackingId: trackingId || null,
    messageId: messageId || null,
    rawStatus: rawStatus || null,
    failureReason: failureReason || null,
    normalizedStatus,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')?.trim() || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
  const webhookSecret = Deno.env.get('MOBILESASA_WEBHOOK_SECRET')?.trim() || '';

  if (!url || !serviceRoleKey) {
    return json({ error: 'Database service not configured' }, 503);
  }
  if (!webhookSecret) {
    console.error('[sms-dlr-mobilesasa] MOBILESASA_WEBHOOK_SECRET is not configured');
    return json({ error: 'Webhook secret not configured' }, 503);
  }

  // CRITICAL: Read exact raw bytes before JSON parsing so HMAC-SHA256 matches Mobile Sasa's signature
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-mobilesasa-signature');
  const secretHeader = request.headers.get('x-mobilesasa-secret');

  const verification = await verifyMobileSasaWebhookSignature({
    rawBody,
    signatureHeader,
    secretHeader,
    webhookSecret,
  });

  if (!verification.valid) {
    console.warn('[sms-dlr-mobilesasa] Signature verification failed:', verification.reason);
    return json({ error: 'Invalid webhook signature', reason: verification.reason }, 401);
  }

  let payload: Record<string, any>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Invalid JSON payload' }, 400);
    }
    payload = parsed as Record<string, any>;
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const fields = extractDlrFields(payload);
  if (!fields.trackingId && !fields.messageId) {
    console.warn('[sms-dlr-mobilesasa] DLR payload missing trackingId and messageId');
    return json({ received: true, matched: false, reason: 'missing_identifiers' }, 200);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  let deliveryRow: { id: string; status: string } | null = null;

  if (fields.trackingId) {
    const { data } = await admin
      .from('notification_deliveries')
      .select('id, status')
      .eq('tracking_id', fields.trackingId)
      .maybeSingle();
    if (data?.id) deliveryRow = data as { id: string; status: string };
  }

  if (!deliveryRow && fields.messageId) {
    const { data } = await admin
      .from('notification_deliveries')
      .select('id, status')
      .eq('provider', 'mobilesasa')
      .eq('provider_message_id', fields.messageId)
      .maybeSingle();
    if (data?.id) deliveryRow = data as { id: string; status: string };
  }

  if (!deliveryRow) {
    console.warn('[sms-dlr-mobilesasa] No matching notification_deliveries row found', {
      trackingId: fields.trackingId,
      messageId: fields.messageId,
    });
    return json({ received: true, matched: false }, 200);
  }

  const nowIso = new Date().toISOString();
  const updatePatch: Record<string, unknown> = {
    dlr_status: fields.rawStatus || fields.normalizedStatus,
    dlr_received_at: nowIso,
    provider_response: payload,
    updated_at: nowIso,
  };

  if (fields.messageId) {
    updatePatch.provider_message_id = fields.messageId;
  }

  // Idempotent state progression: never downgrade an already-delivered SMS
  if (deliveryRow.status !== 'delivered') {
    if (fields.normalizedStatus === 'delivered') {
      updatePatch.status = 'delivered';
      updatePatch.last_error = null;
    } else if (fields.normalizedStatus === 'failed') {
      updatePatch.status = 'failed';
      updatePatch.last_error = (
        fields.failureReason ||
        `Mobile Sasa DLR: ${fields.rawStatus || 'failed'}`
      ).slice(0, 500);
    }
  }

  const { error: updateErr } = await admin
    .from('notification_deliveries')
    .update(updatePatch)
    .eq('id', deliveryRow.id);

  if (updateErr) {
    console.error('[sms-dlr-mobilesasa] Failed to update delivery row:', updateErr.message);
    return json({ error: 'Database update failed' }, 500);
  }

  return json({
    received: true,
    matched: true,
    deliveryId: deliveryRow.id,
    normalizedStatus: fields.normalizedStatus,
  });
});
