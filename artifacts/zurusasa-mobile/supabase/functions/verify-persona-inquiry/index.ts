/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PERSONA_API_BASE = 'https://api.withpersona.com/api/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication is required', code: 'UNAUTHENTICATED' }, 401);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const personaApiKey = Deno.env.get('PERSONA_API_KEY')?.trim() || '';

  if (!url || !anonKey || !serviceRoleKey) {
    return json({ error: 'Verification database service is not configured', code: 'DB_NOT_CONFIGURED' }, 503);
  }

  // Fail closed: require server-side Persona API key
  if (!personaApiKey) {
    console.error('[verify-persona-inquiry] PERSONA_API_KEY is not configured');
    return json({ error: 'Identity verification service is not configured', code: 'MISSING_API_KEY' }, 503);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Authentication is required', code: 'UNAUTHENTICATED' }, 401);

  let body: { inquiryId?: unknown; status?: unknown; fields?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, 400);
  }

  const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
  if (!/^inq_[A-Za-z0-9_-]+$/.test(inquiryId)) {
    return json({ error: 'A valid Persona inquiryId (inq_...) is required', code: 'INVALID_INQUIRY_ID' }, 400);
  }

  // Authoritative lookup against Persona REST API (never trust client-reported status)
  let serverInquiryStatus = '';
  let serverRefId = '';
  try {
    const res = await fetch(`${PERSONA_API_BASE}/inquiries/${encodeURIComponent(inquiryId)}`, {
      headers: {
        Authorization: `Bearer ${personaApiKey}`,
        Accept: 'application/json',
        'Persona-Version': '2023-01-05',
        'Key-Inflection': 'camel',
      },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const resolvedEnvId = res.headers.get('persona-environment-id') || null;
      const personaRequestId = res.headers.get('request-id') || null;
      console.error('[verify-persona-inquiry] Persona API lookup failed:', {
        status: res.status,
        inquiryId,
        resolvedEnvId,
        personaRequestId,
        body: errBody,
      });
      return json(
        {
          error:
            res.status === 404
              ? 'Verification inquiry was not found in the active Persona environment.'
              : 'Could not verify inquiry status with Persona API.',
          code: res.status === 404 ? 'PERSONA_INQUIRY_NOT_FOUND' : 'PERSONA_LOOKUP_FAILED',
          personaStatus: res.status,
          environmentId: resolvedEnvId,
          requestId: personaRequestId,
        },
        res.status === 404 ? 404 : 502,
      );
    }

    const jsonRes = await res.json();
    const attrs = jsonRes?.data?.attributes ?? {};
    serverInquiryStatus = String(attrs.status ?? '');
    serverRefId = String(attrs.referenceId ?? attrs['reference-id'] ?? attrs.reference_id ?? '');
  } catch (err) {
    console.error('[verify-persona-inquiry] Persona network failure:', err);
    return json(
      { error: 'Identity verification provider could not be reached', code: 'PERSONA_NETWORK_ERROR' },
      502,
    );
  }

  // Enforce strict inquiry ownership
  if (!serverRefId || serverRefId !== user.id) {
    return json(
      { error: 'Inquiry does not belong to the authenticated user', code: 'INQUIRY_OWNERSHIP_MISMATCH' },
      403,
    );
  }

  const normalized = serverInquiryStatus.toLowerCase().trim();
  let finalStatus: 'verified' | 'failed' | 'pending' | 'canceled' = 'pending';
  let isVerified = false;

  if (normalized === 'completed' || normalized === 'approved' || normalized === 'verified') {
    finalStatus = 'verified';
    isVerified = true;
  } else if (normalized === 'declined' || normalized === 'failed' || normalized === 'rejected') {
    finalStatus = 'failed';
    isVerified = false;
  } else if (normalized === 'canceled' || normalized === 'cancelled' || normalized === 'expired') {
    finalStatus = 'canceled';
    isVerified = false;
  } else {
    finalStatus = 'pending';
    isVerified = false;
  }

  const now = new Date().toISOString();
  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { error: updateErr } = await adminClient
    .from('profiles')
    .update({
      persona_inquiry_id: inquiryId,
      verification_status: finalStatus,
      identity_verification_status: isVerified
        ? 'Verified'
        : finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1),
      is_verified: isVerified,
      ...(isVerified ? { verified_at: now } : {}),
      verification_updated_at: now,
      verification_details: {
        inquiry_id: inquiryId,
        verified_status: serverInquiryStatus,
        final_status: finalStatus,
        verified_by: 'persona_api',
        updated_at: now,
      },
    })
    .eq('id', user.id);

  if (updateErr) {
    console.error('[verify-persona-inquiry] Error updating profile:', updateErr);
    return json({ error: 'Failed to persist verification status', code: 'PROFILE_UPDATE_FAILED' }, 500);
  }

  return json({
    success: true,
    userId: user.id,
    inquiryId,
    verificationStatus: finalStatus,
    isVerified,
    verifiedAt: isVerified ? now : null,
  });
});
