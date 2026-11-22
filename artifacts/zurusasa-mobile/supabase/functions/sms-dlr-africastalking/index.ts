/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { timingSafeEqual } from '../_shared/workerAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-dlr-secret, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeAtDlrStatus(raw: string): 'delivered' | 'failed' | 'sent' | 'unknown' {
  const s = raw.trim().toLowerCase();
  if (s === 'success' || s === 'delivered') return 'delivered';
  if (s === 'failed' || s === 'rejected') return 'failed';
  if (s === 'sent' || s === 'submitted' || s === 'buffered') return 'sent';
  return 'unknown';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')?.trim() || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
  const dlrSecret = Deno.env.get('AFRICASTALKING_DLR_SECRET')?.trim() || '';

  if (!url || !serviceRoleKey) {
    return json({ error: 'Database service not configured' }, 503);
  }
  if (!dlrSecret) {
    console.error('[sms-dlr-africastalking] AFRICASTALKING_DLR_SECRET is not configured');
    return json({ error: 'Webhook secret not configured' }, 503);
  }

  const reqUrl = new URL(request.url);
  const suppliedSecret =
    request.headers.get('x-dlr-secret')?.trim() ||
    reqUrl.searchParams.get('secret')?.trim() ||
    '';

  if (!suppliedSecret || !timingSafeEqual(suppliedSecret, dlrSecret)) {
    return json({ error: 'Unauthorized DLR callback' }, 401);
  }

  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  let fields: Record<string, string> = {};

  try {
    if (contentType.includes('application/json')) {
      const parsed = (await request.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed ?? {})) {
        fields[k] = String(v ?? '');
      }
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params.entries()) {
        fields[k] = v;
      }
    }
  } catch {
    return json({ error: 'Invalid callback payload' }, 400);
  }

  const messageId = (fields.id || fields.messageId || '').trim();
  const rawStatus = (fields.status || '').trim();
  const failureReason = (fields.failureReason || '').trim();

  if (!messageId) {
    return json({ received: true, matched: false, reason: 'missing_message_id' }, 200);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: deliveryRow } = await admin
    .from('notification_deliveries')
    .select('id, status')
    .eq('provider', 'africastalking')
    .eq('provider_message_id', messageId)
    .maybeSingle();

  if (!deliveryRow?.id) {
    return json({ received: true, matched: false }, 200);
  }

  const normalized = normalizeAtDlrStatus(rawStatus);
  const nowIso = new Date().toISOString();
  const updatePatch: Record<string, unknown> = {
    dlr_status: rawStatus || normalized,
    dlr_received_at: nowIso,
    provider_response: fields,
    updated_at: nowIso,
  };

  if (deliveryRow.status !== 'delivered') {
    if (normalized === 'delivered') {
      updatePatch.status = 'delivered';
      updatePatch.last_error = null;
    } else if (normalized === 'failed') {
      updatePatch.status = 'failed';
      updatePatch.last_error = (
        failureReason || `Africa's Talking DLR: ${rawStatus || 'failed'}`
      ).slice(0, 500);
    }
  }

  const { error: updateErr } = await admin
    .from('notification_deliveries')
    .update(updatePatch)
    .eq('id', deliveryRow.id);

  if (updateErr) {
    console.error('[sms-dlr-africastalking] Failed to update delivery row:', updateErr.message);
    return json({ error: 'Database update failed' }, 500);
  }

  return json({
    received: true,
    matched: true,
    deliveryId: deliveryRow.id,
    normalizedStatus: normalized,
  });
});
