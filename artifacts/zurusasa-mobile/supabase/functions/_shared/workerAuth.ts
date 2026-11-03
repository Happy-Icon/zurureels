/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Constant-time string comparison to prevent timing side-channel attacks
 * on shared secrets and HMAC digests.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length || aBytes.length === 0) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export interface WorkerAuthResult {
  authorized: boolean;
  mode?: 'cron_secret' | 'service_role' | 'admin_jwt';
  userId?: string;
  status: number;
  error?: string;
}

/**
 * Authorizes internal financial/background worker invocations via:
 *   1. `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`
 *   2. `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
 *   3. Authenticated Supabase user JWT with `public.profiles.role = 'admin'`
 */
export async function authorizeWorkerOrAdmin(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
): Promise<WorkerAuthResult> {
  const cronSecret = Deno.env.get('CRON_SECRET')?.trim() || '';
  const headerCronSecret = request.headers.get('x-cron-secret')?.trim() || '';
  const authHeader = request.headers.get('authorization')?.trim() || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (cronSecret) {
    if (
      (headerCronSecret && timingSafeEqual(headerCronSecret, cronSecret)) ||
      (bearerToken && timingSafeEqual(bearerToken, cronSecret))
    ) {
      return { authorized: true, mode: 'cron_secret', status: 200 };
    }
  }

  if (serviceRoleKey && bearerToken && timingSafeEqual(bearerToken, serviceRoleKey)) {
    return { authorized: true, mode: 'service_role', status: 200 };
  }

  if (!authHeader || !bearerToken) {
    return {
      authorized: false,
      status: 401,
      error: 'Authentication required (missing worker secret or bearer token)',
    };
  }

  if (!anonKey || !serviceRoleKey) {
    return {
      authorized: false,
      status: 503,
      error: 'Auth configuration unavailable',
    };
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return { authorized: false, status: 401, error: 'Invalid or expired authorization token' };
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'admin') {
      return { authorized: true, mode: 'admin_jwt', userId: user.id, status: 200 };
    }

    return { authorized: false, userId: user.id, status: 403, error: 'Forbidden: admin or worker credentials required' };
  } catch {
    return { authorized: false, status: 401, error: 'Authorization check failed' };
  }
}
