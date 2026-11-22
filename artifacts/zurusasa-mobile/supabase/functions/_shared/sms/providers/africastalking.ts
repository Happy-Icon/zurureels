import {
  defaultGetEnv,
  type EnvGetter,
  type SmsProviderAdapter,
  type SmsSendRequest,
  type SmsSendResult,
} from '../types.ts';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Africa's Talking SMS Provider Adapter (preserved existing integration).
 * Supports both production and sandbox endpoints automatically via AFRICASTALKING_USERNAME.
 */
export const africasTalkingProvider: SmsProviderAdapter = {
  name: 'africastalking',

  isConfigured(getEnv: EnvGetter = defaultGetEnv): boolean {
    const apiKey = getEnv('AFRICASTALKING_API_KEY')?.trim();
    const username = getEnv('AFRICASTALKING_USERNAME')?.trim();
    return Boolean(apiKey && username);
  },

  async send(
    req: SmsSendRequest,
    opts?: { getEnv?: EnvGetter; fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<SmsSendResult> {
    const getEnv = opts?.getEnv ?? defaultGetEnv;
    const fetchImpl = opts?.fetchImpl ?? fetch;
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const apiKey = getEnv('AFRICASTALKING_API_KEY')?.trim();
    const username = getEnv('AFRICASTALKING_USERNAME')?.trim();
    const senderId = (req.senderId || getEnv('AFRICASTALKING_SENDER_ID') || '').trim();

    if (!apiKey || !username) {
      return {
        accepted: false,
        provider: 'africastalking',
        trackingId: req.trackingId,
        error: "Africa's Talking is not configured (missing AFRICASTALKING_API_KEY or AFRICASTALKING_USERNAME)",
        errorKind: 'unconfigured',
        failoverEligible: true,
      };
    }

    const endpoint =
      username.toLowerCase() === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

    const form = new URLSearchParams();
    form.set('username', username);
    form.set('to', req.toE164);
    form.set('message', req.text);
    if (senderId.length > 0) {
      form.set('from', senderId);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          apiKey,
        },
        body: form.toString(),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
      const recipients = payload?.SMSMessageData?.Recipients;
      const firstRecipient = Array.isArray(recipients) ? recipients[0] : null;
      const statusCode = Number(firstRecipient?.statusCode ?? 0);
      const statusText = String(firstRecipient?.status || payload?.SMSMessageData?.Message || '');

      // Note: statusCode 100 (Processed), 101 (Sent), 102 (Queued) indicate gateway acceptance only,
      // NOT handset delivery. True delivery is reconciled via sms-dlr-africastalking webhook.
      const isAccepted =
        response.ok &&
        (statusCode === 100 ||
          statusCode === 101 ||
          statusCode === 102 ||
          statusText.toLowerCase() === 'success');

      if (isAccepted) {
        return {
          accepted: true,
          provider: 'africastalking',
          httpStatus: response.status,
          providerMessageId: firstRecipient?.messageId ? String(firstRecipient.messageId) : null,
          trackingId: req.trackingId,
          costParts: null,
          rawStatus: statusText || String(statusCode || 'accepted'),
          rawResponse: payload,
        };
      }

      const isBalanceOrTransient =
        response.status === 429 ||
        response.status >= 500 ||
        statusCode === 405 || // InsufficientBalance
        statusCode === 500 ||
        statusCode === 501 ||
        statusCode === 502;

      const isAuthFailure = response.status === 401 || response.status === 403;

      return {
        accepted: false,
        provider: 'africastalking',
        httpStatus: response.status,
        trackingId: req.trackingId,
        rawStatus: statusText || String(statusCode || response.status),
        error: statusText || `Africa's Talking HTTP ${response.status}`,
        errorKind: isBalanceOrTransient ? 'retryable' : 'permanent',
        failoverEligible: isBalanceOrTransient || isAuthFailure,
        rawResponse: payload,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      return {
        accepted: false,
        provider: 'africastalking',
        trackingId: req.trackingId,
        error: isTimeout
          ? `Africa's Talking request timed out after ${timeoutMs}ms`
          : err?.message || "Africa's Talking network error",
        errorKind: 'retryable',
        failoverEligible: true,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
