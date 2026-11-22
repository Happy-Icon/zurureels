export type SmsProviderName = 'mobilesasa' | 'africastalking';

export type SmsErrorKind =
  | 'retryable'
  | 'permanent'
  | 'duplicate_blocked'
  | 'unconfigured'
  | 'disabled';

export type NormalizedDlrStatus =
  | 'delivered'
  | 'failed'
  | 'sent'
  | 'unknown';

export interface SmsSendRequest {
  toE164: string;
  text: string;
  trackingId: string;
  senderId?: string;
}

export interface SmsSendResult {
  accepted: boolean;
  provider: SmsProviderName | 'unconfigured' | 'disabled';
  httpStatus?: number;
  providerMessageId?: string | null;
  trackingId?: string;
  costParts?: number | null;
  rawStatus?: string;
  error?: string;
  errorKind?: SmsErrorKind;
  failoverEligible?: boolean;
  usedFallback?: boolean;
  primaryError?: string;
  rawResponse?: Record<string, unknown>;
}

export interface SmsDlrLookupResult {
  found: boolean;
  normalizedStatus: NormalizedDlrStatus;
  rawStatus?: string;
  providerMessageId?: string | null;
  rawResponse?: Record<string, unknown>;
}

export type EnvGetter = (key: string) => string | undefined;

export function defaultGetEnv(key: string): string | undefined {
  const g = globalThis as {
    Deno?: { env?: { get: (k: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  if (g.Deno?.env) {
    return g.Deno.env.get(key);
  }
  return g.process?.env?.[key];
}

export interface SmsProviderAdapter {
  readonly name: SmsProviderName;
  isConfigured(getEnv?: EnvGetter): boolean;
  send(
    req: SmsSendRequest,
    opts?: { getEnv?: EnvGetter; fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<SmsSendResult>;
  lookupDlr?(
    params: { trackingId?: string; messageId?: string },
    opts?: { getEnv?: EnvGetter; fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<SmsDlrLookupResult>;
}
