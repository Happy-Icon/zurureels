/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { timingSafeEqual } from '../_shared/workerAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, persona-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_WEBHOOK_AGE_SECONDS = 300; // 5-minute replay tolerance

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies Persona's `Persona-Signature` header (`t=<unix_ts>,v1=<hex_hmac>`).
 * Supports space-separated signature groups emitted during webhook secret rotation.
 */
async function verifyPersonaSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const groups = signatureHeader.trim().split(/\s+/);

  for (const group of groups) {
    let timestamp: string | null = null;
    const v1Signatures: string[] = [];

    for (const part of group.split(',')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      if (key === 't' && /^\d+$/.test(val)) {
        timestamp = val;
      } else if (key === 'v1' && /^[0-9a-fA-F]{64}$/.test(val)) {
        v1Signatures.push(val.toLowerCase());
      }
    }

    if (!timestamp || v1Signatures.length === 0) continue;

    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum) || Math.abs(nowSeconds - tsNum) > MAX_WEBHOOK_AGE_SECONDS) {
      continue;
    }

    const expectedHex = await computeHmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
    for (const candidate of v1Signatures) {
      if (timingSafeEqual(candidate, expectedHex)) {
        return true;
      }
    }
  }

  return false;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const personaWebhookSecret = Deno.env.get('PERSONA_WEBHOOK_SECRET')?.trim() || '';

  if (!url || !serviceRoleKey || !personaWebhookSecret) {
    console.error('[persona-webhook] Missing SUPABASE_SERVICE_ROLE_KEY or PERSONA_WEBHOOK_SECRET');
    return json({ error: 'Webhook service is not configured' }, 503);
  }

  const signatureHeader = request.headers.get('persona-signature');
  const rawBody = await request.text();

  const isSignatureValid = await verifyPersonaSignature(rawBody, signatureHeader, personaWebhookSecret);
  if (!isSignatureValid) {
    console.error('[persona-webhook] Invalid or expired Persona-Signature');
    return json({ error: 'Invalid webhook signature' }, 401);
  }

  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const eventAttrs = payload?.data?.attributes ?? {};
  const eventName = eventAttrs.name;
  const inquiryData = eventAttrs.payload?.data ?? {};
  const inquiryId = inquiryData.id;
  const inquiryAttributes = inquiryData.attributes ?? {};
  const status = inquiryAttributes.status;
  const referenceId =
    inquiryAttributes.referenceId ??
    inquiryAttributes['reference-id'] ??
    inquiryAttributes.reference_id;

  if (!inquiryId || !referenceId) {
    return json({ error: 'Missing inquiryId or referenceId in webhook payload' }, 400);
  }

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const normalized = String(status || '').toLowerCase().trim();
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

  const { error: updateErr } = await adminClient
    .from('profiles')
    .update({
      persona_inquiry_id: String(inquiryId),
      verification_status: finalStatus,
      identity_verification_status: isVerified
        ? 'Verified'
        : finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1),
      is_verified: isVerified,
      ...(isVerified ? { verified_at: now } : {}),
      verification_updated_at: now,
      verification_details: {
        inquiry_id: String(inquiryId),
        event_name: eventName,
        status,
        final_status: finalStatus,
        verified_by: 'persona_webhook',
        updated_at: now,
      },
    })
    .eq('id', String(referenceId));

  if (updateErr) {
    console.error('[persona-webhook] Failed to update profile:', updateErr);
    return json({ error: 'Failed to update profile' }, 500);
  }

  return json({ received: true, inquiryId, userId: referenceId, status: finalStatus });
});
