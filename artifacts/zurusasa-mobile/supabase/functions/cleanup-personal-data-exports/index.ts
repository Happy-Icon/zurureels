/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeWorkerOrAdmin } from '../_shared/workerAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const auth = await authorizeWorkerOrAdmin(request, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
  if (!auth.authorized) {
    return json({ error: auth.error || 'Unauthorized' }, auth.status);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const now = new Date().toISOString();

  // Find expired completed requests
  const { data: expiredRequests, error: queryErr } = await serviceClient
    .from('personal_data_requests')
    .select('id, user_id, json_storage_path, pdf_storage_path')
    .eq('status', 'completed')
    .lte('expires_at', now)
    .limit(50);

  if (queryErr) {
    console.error('[cleanup-personal-data-exports] Query error:', queryErr);
    return json({ error: 'Failed to query expired requests' }, 500);
  }

  if (!expiredRequests || expiredRequests.length === 0) {
    return json({ message: 'No expired exports to purge', purged_count: 0 });
  }

  let purgedCount = 0;

  for (const req of expiredRequests) {
    const pathsToDelete: string[] = [];
    if (req.json_storage_path) pathsToDelete.push(req.json_storage_path);
    if (req.pdf_storage_path) pathsToDelete.push(req.pdf_storage_path);

    if (pathsToDelete.length > 0) {
      const { error: delErr } = await serviceClient.storage
        .from('personal-data-exports')
        .remove(pathsToDelete);
      if (delErr) {
        console.warn(`[cleanup-personal-data-exports] Failed to delete objects for req ${req.id}:`, delErr);
      }
    }

    await serviceClient
      .from('personal_data_requests')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.id);

    await serviceClient.from('personal_data_audit_logs').insert({
      request_id: req.id,
      user_id: req.user_id,
      event_type: 'export_retention_purged',
      actor_role: 'system_cron',
      details: { purged_paths: pathsToDelete },
    });

    purgedCount++;
  }

  return json({
    success: true,
    message: `Purged ${purgedCount} expired personal data export(s)`,
    purged_count: purgedCount,
  });
});
