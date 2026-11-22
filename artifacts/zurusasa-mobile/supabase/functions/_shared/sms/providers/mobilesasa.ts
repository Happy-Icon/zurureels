import {
  defaultGetEnv,
  type EnvGetter,
  type NormalizedDlrStatus,
  type SmsDlrLookupResult,
  type SmsProviderAdapter,
  type SmsSendRequest,
  type SmsSendResult,
} from '../types.ts';

const DEFAULT_TIMEOUT_MS = 10_000;
const DLR_TIMEOUT_MS = 8_000;
const MOBILESASA_V2_SEND_URL = 'https://api.mobilesasa.com/v2/send/message';
const MOBILESASA_V1_DLR_URL = 'https://api.mobilesasa.com/v1/dlr';

function timingSafeStringEqual(a: string, b: string): boolean {
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

export function normalizeMobileSasaDlrStatus(raw: unknown): NormalizedDlrStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'unknown';

  if (
    s === 'delivrd' ||
    s === 'delivered' ||
    s === 'success' ||
    s === 'deliveredtoterminal'
  ) {
    return 'delivered';
  }
  if (
    s === 'undeliv' ||
    s === 'undelivered' ||
    s === 'expired' ||
    s === 'rejectd' ||
    s === 'rejected' ||
    s === 'failed' ||
    s === 'absent_subscriber' ||
    s === 'blacklisted' ||
    s === 'dnd'
  ) {
    return 'failed';
  }
  if (
    s === 'sent' ||
    s === 'accepted' ||
    s === 'queued' ||
    s === 'pending' ||
    s === 'submitted' ||
    s === 'enroute'
  ) {
    return 'sent';
  }
  return 'unknown';
}

export interface VerifyMobileSasaWebhookParams {
  rawBody: string;
  signatureHeader: string | null;
  secretHeader?: string | null;
  webhookSecret: string;
  nowSeconds?: number;
  maxAgeSeconds?: number;
}

export interface VerifyMobileSasaWebhookResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

/**
 * Verifies Mobile Sasa webhook authenticity per https://docs.mobilesasa.com/api/webhook-security:
 *   - Optional/present `X-MobileSasa-Secret` matches configured webhook secret in constant time.
 *   - `X-MobileSasa-Signature: t=<unix_seconds>,v1=<hex>` where
 *     `v1 = HMAC-SHA256(webhookSecret, `${t}.${rawBody}`)` over exact raw request bytes.
 *   - Enforces replay window (default <= 300 seconds).
 */
export async function verifyMobileSasaWebhookSignature(
  params: VerifyMobileSasaWebhookParams,
): Promise<VerifyMobileSasaWebhookResult> {
  const {
    rawBody,
    signatureHeader,
    secretHeader,
    webhookSecret,
    nowSeconds = Math.floor(Date.now() / 1000),
    maxAgeSeconds = 300,
  } = params;

  const secret = (webhookSecret || '').trim();
  if (!secret) {
    return { valid: false, reason: 'webhook_secret_unconfigured' };
  }

  if (secretHeader && !timingSafeStringEqual(secretHeader.trim(), secret)) {
    return { valid: false, reason: 'invalid_secret_header' };
  }

  const sigRaw = (signatureHeader || '').trim();
  if (!sigRaw) {
    return { valid: false, reason: 'missing_signature_header' };
  }

  let timestampStr = '';
  const v1Candidates: string[] = [];

  for (const part of sigRaw.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === 't' && !timestampStr) {
      timestampStr = v;
    } else if (k === 'v1' && v) {
      v1Candidates.push(v.toLowerCase());
    }
  }

  const timestamp = Number(timestampStr);
  if (!timestampStr || !Number.isFinite(timestamp) || !Number.isInteger(timestamp)) {
    return { valid: false, reason: 'invalid_signature_timestamp' };
  }

  if (v1Candidates.length === 0) {
    return { valid: false, reason: 'missing_v1_signature' };
  }

  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) {
    return { valid: false, reason: 'signature_timestamp_expired', timestamp };
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signedPayload = `${timestampStr}.${rawBody}`;
    const macBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const computedHex = Array.from(new Uint8Array(macBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const matched = v1Candidates.some((candidate) => timingSafeStringEqual(computedHex, candidate));
    if (!matched) {
      return { valid: false, reason: 'signature_mismatch', timestamp };
    }

    return { valid: true, timestamp };
  } catch {
    return { valid: false, reason: 'crypto_verification_error', timestamp };
  }
}

/**
 * Mobile Sasa SMS Provider Adapter (https://docs.mobilesasa.com/).
 * Uses `POST /v2/send/message` with scoped `mbs_` Bearer tokens, client `trackingId`,
 * integer `cost` reporting, and `POST /v1/dlr` reconcile-before-retry lookup.
 */
export const mobileSasaProvider: SmsProviderAdapter = {
  name: 'mobilesasa',

  isConfigured(getEnv: EnvGetter = defaultGetEnv): boolean {
    const token = getEnv('MOBILESASA_API_TOKEN')?.trim();
    return Boolean(token);
  },

  async send(
    req: SmsSendRequest,
    opts?: { getEnv?: EnvGetter; fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<SmsSendResult> {
    const getEnv = opts?.getEnv ?? defaultGetEnv;
    const fetchImpl = opts?.fetchImpl ?? fetch;
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const apiToken = getEnv('MOBILESASA_API_TOKEN')?.trim();
    const senderID = (req.senderId || getEnv('MOBILESASA_SENDER_ID') || 'MOBILESASA').trim();

    if (!apiToken) {
      return {
        accepted: false,
        provider: 'mobilesasa',
        trackingId: req.trackingId,
        error: 'Mobile Sasa is not configured (missing MOBILESASA_API_TOKEN)',
        errorKind: 'unconfigured',
        failoverEligible: true,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(MOBILESASA_V2_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          senderID,
          phone: req.toE164,
          message: req.text,
          trackingId: req.trackingId,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
      const responseCode = String(payload?.responseCode ?? '').trim();
      const apiMsg = String(payload?.message || payload?.error || response.statusText || '').trim();
      const messageId = payload?.messageId ? String(payload.messageId) : null;
      const rawCost = payload?.cost;
      const costParts =
        typeof rawCost === 'number' && Number.isFinite(rawCost)
          ? Math.round(rawCost)
          : typeof rawCost === 'string' && rawCost.trim() !== '' && Number.isFinite(Number(rawCost))
            ? Math.round(Number(rawCost))
            : null;

      // Mobile Sasa v2 returns status: true & responseCode: '0200' (Accepted)
      const isAccepted =
        response.ok &&
        payload?.status === true &&
        (responseCode === '0200' || responseCode === '0201' || Boolean(messageId));

      if (isAccepted) {
        return {
          accepted: true,
          provider: 'mobilesasa',
          httpStatus: response.status,
          providerMessageId: messageId,
          trackingId: req.trackingId,
          costParts,
          rawStatus: responseCode || '0200',
          rawResponse: payload,
        };
      }

      // 0409 / HTTP 409: Same-day duplicate blocked by Mobile Sasa — never blindly retry or failover
      if (responseCode === '0409' || response.status === 409) {
        return {
          accepted: false,
          provider: 'mobilesasa',
          httpStatus: response.status,
          trackingId: req.trackingId,
          rawStatus: responseCode || '0409',
          error: apiMsg || 'Mobile Sasa blocked duplicate message (0409)',
          errorKind: 'duplicate_blocked',
          failoverEligible: false,
          rawResponse: payload,
        };
      }

      // 0402 / HTTP 402: Insufficient balance — retryable & eligible for automatic failover
      if (responseCode === '0402' || response.status === 402) {
        return {
          accepted: false,
          provider: 'mobilesasa',
          httpStatus: response.status,
          trackingId: req.trackingId,
          rawStatus: responseCode || '0402',
          error: apiMsg || 'Mobile Sasa insufficient SMS balance (0402)',
          errorKind: 'retryable',
          failoverEligible: true,
          rawResponse: payload,
        };
      }

      // 0401 / 0403: Auth or token scope error — permanent on Mobile Sasa, eligible for failover
      if (
        responseCode === '0401' ||
        responseCode === '0403' ||
        response.status === 401 ||
        response.status === 403
      ) {
        return {
          accepted: false,
          provider: 'mobilesasa',
          httpStatus: response.status,
          trackingId: req.trackingId,
          rawStatus: responseCode || String(response.status),
          error: apiMsg || `Mobile Sasa auth/scope error (${responseCode || response.status})`,
          errorKind: 'permanent',
          failoverEligible: true,
          rawResponse: payload,
        };
      }

      // 0422 / 400 / 404: Validation or bad request — permanent, do not failover invalid payloads
      if (
        responseCode === '0422' ||
        responseCode === '0404' ||
        response.status === 400 ||
        response.status === 404 ||
        response.status === 422
      ) {
        return {
          accepted: false,
          provider: 'mobilesasa',
          httpStatus: response.status,
          trackingId: req.trackingId,
          rawStatus: responseCode || String(response.status),
          error: apiMsg || `Mobile Sasa validation error (${responseCode || response.status})`,
          errorKind: 'permanent',
          failoverEligible: false,
          rawResponse: payload,
        };
      }

      // 429 / 5xx / unknown gateway failure — retryable & eligible for failover
      return {
        accepted: false,
        provider: 'mobilesasa',
        httpStatus: response.status,
        trackingId: req.trackingId,
        rawStatus: responseCode || String(response.status),
        error: apiMsg || `Mobile Sasa HTTP ${response.status}`,
        errorKind: 'retryable',
        failoverEligible: true,
        rawResponse: payload,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      return {
        accepted: false,
        provider: 'mobilesasa',
        trackingId: req.trackingId,
        error: isTimeout
          ? `Mobile Sasa request timed out after ${timeoutMs}ms`
          : err?.message || 'Mobile Sasa network error',
        errorKind: 'retryable',
        failoverEligible: true,
      };
    } finally {
      clearTimeout(timer);
    }
  },

  async lookupDlr(
    params: { trackingId?: string; messageId?: string },
    opts?: { getEnv?: EnvGetter; fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<SmsDlrLookupResult> {
    const getEnv = opts?.getEnv ?? defaultGetEnv;
    const fetchImpl = opts?.fetchImpl ?? fetch;
    const timeoutMs = opts?.timeoutMs ?? DLR_TIMEOUT_MS;
    const apiToken = getEnv('MOBILESASA_API_TOKEN')?.trim();

    if (!apiToken || (!params.trackingId && !params.messageId)) {
      return { found: false, normalizedStatus: 'unknown' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, string> = {};
      if (params.messageId) body.messageId = params.messageId;
      else if (params.trackingId) body.trackingId = params.trackingId;

      const response = await fetchImpl(MOBILESASA_V1_DLR_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
      if (!response.ok) {
        return { found: false, normalizedStatus: 'unknown', rawResponse: payload };
      }

      const record =
        (Array.isArray(payload?.data) ? payload.data[0] : payload?.data) ||
        payload?.dlr ||
        {};

      const rawStatus = String(
        payload?.deliveryStatus ??
          payload?.dlrStatus ??
          record?.deliveryStatus ??
          record?.dlrStatus ??
          record?.dlr_status ??
          record?.description ??
          record?.status_text ??
          (typeof payload?.status === 'string' ? payload.status : '') ??
          (typeof record?.status === 'string' ? record.status : '') ??
          '',
      ).trim();

      const providerMessageId =
        payload?.messageId ||
        payload?.message_id ||
        payload?.reference ||
        record?.messageId ||
        record?.message_id ||
        record?.reference
          ? String(
              payload?.messageId ||
                payload?.message_id ||
                payload?.reference ||
                record?.messageId ||
                record?.message_id ||
                record?.reference,
            )
          : null;

      const normalizedStatus = normalizeMobileSasaDlrStatus(rawStatus);
      const found =
        Boolean(providerMessageId) ||
        normalizedStatus !== 'unknown' ||
        (payload?.status === true && String(payload?.responseCode || '') === '0200');

      return {
        found,
        normalizedStatus,
        rawStatus: rawStatus || undefined,
        providerMessageId,
        rawResponse: payload,
      };
    } catch {
      return { found: false, normalizedStatus: 'unknown' };
    } finally {
      clearTimeout(timer);
    }
  },
};
