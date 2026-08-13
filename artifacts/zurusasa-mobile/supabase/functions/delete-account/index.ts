import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication is required' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // ── 1. Authenticate the calling user ─────────────────────────────────────
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Authentication is required' }, 401);

  // Enforce Rate Limit: max 3 requests per 5 minutes per user
  const rl = await checkRateLimit(request, 'delete_account', 3, 300, user.id);
  if (!rl.allowed) {
    return json({ error: 'Too many account deletion requests. Please wait a few minutes.' }, 429);
  }

  // ── 2. Admin client (service-role) for storage + auth deletion ───────────
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── 3. Marketplace eligibility gate ──────────────────────────────────────
  // Block deletion if the user has active marketplace obligations.
  const { data: eligibility, error: eligibilityError } = await userClient.rpc(
    'check_deletion_eligibility',
    { p_user_id: user.id }
  );

  if (eligibilityError) {
    console.error('Eligibility check failed:', eligibilityError);
    return json({ error: eligibilityError.message || 'Failed to check deletion eligibility' }, 500);
  }

  if (eligibility && !eligibility.can_delete) {
    return json({
      error: 'Account cannot be deleted while marketplace obligations exist.',
      can_delete: false,
      blockers: eligibility.blockers,
    }, 409);
  }

  // ── 4. Delete storage files across all user-scoped buckets ───────────────
  const buckets = ['avatars', 'identity-documents', 'reels'];
  for (const bucket of buckets) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(user.id);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${user.id}/${f.name}`);
        await admin.storage.from(bucket).remove(paths);
      }
    } catch (storageErr) {
      // Tolerate missing/empty folders — not every user has all buckets.
      console.warn(`Storage cleanup for bucket "${bucket}" skipped:`, storageErr);
    }
  }

  // ── 5. Purge DB rows via the RPC (runs as the user so auth.uid() passes) ─
  const { error: rpcError } = await userClient.rpc('delete_user_account', {
    p_user_id: user.id,
  });

  if (rpcError) {
    console.error('Account deletion RPC failed:', rpcError);
    return json({ error: rpcError.message || 'Failed to delete account data' }, 500);
  }

  // ── 6. Delete the auth.users row (requires service-role) ─────────────────
  // With the SET NULL FKs in place, retained financial rows keep their data
  // and the user's id link is simply nulled out.
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    console.error('auth.admin.deleteUser failed:', authDeleteError);
    return json({
      error: authDeleteError.message || 'Failed to remove auth credentials',
    }, 500);
  }

  return json({
    success: true,
    message: 'Your account and data have been completely removed.',
  });
});
