/// <reference path="../deno.d.ts" />
import { sanitizeSmsText } from '../_shared/sms/gsm7.ts';
import { formatToE164, maskPhoneForLogs } from '../_shared/sms/phone.ts';
import { sendSmsViaGateway } from '../_shared/sms/smsGateway.ts';
import { defaultGetEnv, type EnvGetter } from '../_shared/sms/types.ts';

const HOOK_SMS_TIMEOUT_MS = 3_500;
const WEBHOOK_MAX_AGE_SECONDS = 300;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hookError(httpCode: number, message: string): Response {
  return jsonResponse(
    {
      error: {
        http_code: httpCode,
        message,
      },
    },
    httpCode,
  );
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Verifies Supabase Auth Hook Standard Webhooks HMAC-SHA256 signature when
 * SEND_SMS_HOOK_SECRET is configured (supports `v1,whsec_<base64>`, `whsec_<base64>`, or raw base64).
 */
export async function verifySendSmsHookSignature(params: {
  rawBody: string;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
  hookSecret: string;
  nowSeconds?: number;
}): Promise<{ valid: boolean; reason?: string }> {
  const {
    rawBody,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    hookSecret,
    nowSeconds = Math.floor(Date.now() / 1000),
  } = params;

  const trimmedSecret = hookSecret.trim();
  if (!trimmedSecret) return { valid: true };

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { valid: false, reason: 'missing_webhook_headers' };
  }

  const ts = Number(webhookTimestamp.trim());
  if (!Number.isFinite(ts) || !Number.isInteger(ts)) {
    return { valid: false, reason: 'invalid_webhook_timestamp' };
  }

  if (Math.abs(nowSeconds - ts) > WEBHOOK_MAX_AGE_SECONDS) {
    return { valid: false, reason: 'expired_webhook_timestamp' };
  }

  try {
    const normalizedSecret = trimmedSecret.replace(/^v1,/, '').replace(/^whsec_/, '');
    const secretBytes = decodeBase64(normalizedSecret);
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes as unknown as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
    const expectedSig = new TextEncoder().encode(encodeBase64(new Uint8Array(mac)));

    const candidates = webhookSignature
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('v1,'))
      .map((entry) => entry.slice(3));

    if (candidates.length === 0) {
      return { valid: false, reason: 'missing_v1_signature' };
    }

    const matched = candidates.some((candidate) =>
      timingSafeEqualBytes(expectedSig, new TextEncoder().encode(candidate)),
    );

    return matched ? { valid: true } : { valid: false, reason: 'signature_mismatch' };
  } catch {
    return { valid: false, reason: 'signature_verification_error' };
  }
}

export async function handleSendSmsHookRequest(
  req: Request,
  opts?: {
    getEnv?: EnvGetter;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return hookError(405, 'Method not allowed');
  }

  const startedAt = Date.now();
  const getEnv = opts?.getEnv ?? defaultGetEnv;
  const hookSecret = (
    getEnv('SEND_SMS_HOOK_SECRET') ||
    getEnv('SUPABASE_AUTH_HOOK_SEND_SMS_SECRET') ||
    ''
  ).trim();

  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return hookError(400, 'Unable to read request body');
  }

  if (hookSecret) {
    const sigCheck = await verifySendSmsHookSignature({
      rawBody,
      webhookId: req.headers.get('webhook-id'),
      webhookTimestamp: req.headers.get('webhook-timestamp'),
      webhookSignature: req.headers.get('webhook-signature'),
      hookSecret,
    });
    if (!sigCheck.valid) {
      console.warn('[custom-sms-sender] Webhook signature rejected:', sigCheck.reason);
      return hookError(401, 'Unauthorized SMS hook request');
    }
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch {
    return hookError(400, 'Invalid JSON payload');
  }

  const user = (payload?.user ?? {}) as Record<string, unknown>;
  const sms = (payload?.sms ?? {}) as Record<string, unknown>;

  // Supabase GoTrue sends user.phone (sign-in/signup) or user.new_phone (phone change),
  // typically WITHOUT a leading '+' (e.g. "254712345678").
  const rawPhone = String(user.new_phone || user.phone || payload?.phone || '').trim();
  const otp = String(sms.otp || sms.code || payload?.otp || '').trim();

  if (!rawPhone || !otp) {
    console.error('[custom-sms-sender] Missing phone or OTP in payload', {
      hasPhone: Boolean(rawPhone),
      hasOtp: Boolean(otp),
    });
    return hookError(400, 'Missing phone number or OTP code');
  }

  const phoneCheck = formatToE164(rawPhone);
  if (!phoneCheck.valid) {
    console.warn('[custom-sms-sender] Invalid phone number rejected:', {
      maskedPhone: maskPhoneForLogs(rawPhone),
      error: phoneCheck.error,
    });
    return hookError(400, phoneCheck.error || 'Invalid phone number format');
  }

  const trackingId = `otp_${crypto.randomUUID()}`;
  const message = sanitizeSmsText(
    `Your ZuruSasa verification code is ${otp}. Valid for 5 minutes. Do not share this code.`,
    160,
  );

  const result = await sendSmsViaGateway(
    {
      toE164: phoneCheck.e164,
      text: message,
      trackingId,
    },
    {
      getEnv,
      fetchImpl: opts?.fetchImpl,
      timeoutMs: opts?.timeoutMs ?? HOOK_SMS_TIMEOUT_MS,
    },
  );

  const latencyMs = Date.now() - startedAt;

  if (!result.accepted) {
    console.error('[custom-sms-sender] SMS dispatch failed:', {
      maskedPhone: maskPhoneForLogs(phoneCheck.e164),
      provider: result.provider,
      usedFallback: Boolean(result.usedFallback),
      httpStatus: result.httpStatus,
      rawStatus: result.rawStatus,
      errorKind: result.errorKind,
      error: result.error,
      primaryError: result.primaryError,
      latencyMs,
    });

    const reasonTag = result.rawStatus || result.errorKind || 'provider_rejected';
    return hookError(
      500,
      `Unable to send verification SMS (${result.provider}: ${reasonTag}). Please try again or sign in with Email.`,
    );
  }

  console.log('[custom-sms-sender] OTP SMS accepted:', {
    maskedPhone: maskPhoneForLogs(phoneCheck.e164),
    provider: result.provider,
    usedFallback: Boolean(result.usedFallback),
    providerMessageId: result.providerMessageId ?? null,
    trackingId,
    costParts: result.costParts ?? null,
    latencyMs,
  });

  // Supabase Auth Send SMS Hook expects HTTP 200 with an empty JSON object on success.
  return jsonResponse({}, 200);
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve((req: Request) => handleSendSmsHookRequest(req));
}
