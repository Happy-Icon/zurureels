/// <reference path="../deno.d.ts" />
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeWorkerOrAdmin } from '../_shared/workerAuth.ts';
import {
  pollExpoPushReceipts,
  processClaimedDeliveries,
  type DeliveryRow,
} from '../_shared/notificationOrchestrator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

let cachedAdmin: { url: string; key: string; client: SupabaseClient } | null = null;
function getAdminClient(url: string, serviceRoleKey: string): SupabaseClient {
  if (cachedAdmin && cachedAdmin.url === url && cachedAdmin.key === serviceRoleKey) {
    return cachedAdmin.client;
  }
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  cachedAdmin = { url, key: serviceRoleKey, client };
  return client;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!url || !serviceRoleKey) {
    return json({ error: 'Database service is not configured' }, 503);
  }

  const auth = await authorizeWorkerOrAdmin(request, url, anonKey, serviceRoleKey);
  if (!auth.authorized) {
    return json({ error: auth.error || 'Unauthorized' }, auth.status);
  }

  const admin = getAdminClient(url, serviceRoleKey);
  const nowIso = new Date().toISOString();

  // Single atomic SQL RPC claim (FOR UPDATE SKIP LOCKED) replaces 60 sequential UPDATE round-trips
  let claimed: DeliveryRow[] = [];
  const { data: rpcClaimed, error: rpcErr } = await admin.rpc('claim_notification_deliveries', {
    p_limit: 60,
    p_stale_minutes: 10,
  });

  if (!rpcErr && Array.isArray(rpcClaimed)) {
    claimed = rpcClaimed as DeliveryRow[];
  } else {
    // Graceful fallback if migration 202611220001 has not been applied yet
    const tenMinsAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    await admin
      .from('notification_deliveries')
      .update({
        status: 'failed',
        next_retry_at: nowIso,
        last_error: 'Recovered from stale processing state',
        updated_at: nowIso,
      })
      .eq('status', 'processing')
      .lte('updated_at', tenMinsAgo);

    const { data: candidates, error: fetchErr } = await admin
      .from('notification_deliveries')
      .select(
        'id, notification_id, user_id, channel, template_key, priority, dedupe_key, payload, status, attempt_count, max_attempts, expo_ticket_id, provider, provider_message_id, tracking_id, last_error',
      )
      .in('status', ['pending', 'failed'])
      .lte('next_retry_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(60);

    if (fetchErr) {
      console.error('[process-notification-queue] Failed to query deliveries:', fetchErr.message);
      return json({ error: 'Failed to query notification queue' }, 500);
    }

    const candidateIds = ((candidates ?? []) as DeliveryRow[]).map((r) => r.id);
    if (candidateIds.length > 0) {
      const { data: lockedRows } = await admin
        .from('notification_deliveries')
        .update({ status: 'processing', updated_at: nowIso })
        .in('id', candidateIds)
        .in('status', ['pending', 'failed'])
        .select(
          'id, notification_id, user_id, channel, template_key, priority, dedupe_key, payload, status, attempt_count, max_attempts, expo_ticket_id, provider, provider_message_id, tracking_id, last_error',
        );
      claimed = (lockedRows ?? []) as DeliveryRow[];
    }
  }

  const deliverySummary =
    claimed.length > 0
      ? await processClaimedDeliveries(admin, claimed)
      : { sent: 0, skipped: 0, failed: 0 };

  const receiptSummary = await pollExpoPushReceipts(admin);

  return json({
    success: true,
    claimed: claimed.length,
    deliveries: deliverySummary,
    receipts: receiptSummary,
  });
});
