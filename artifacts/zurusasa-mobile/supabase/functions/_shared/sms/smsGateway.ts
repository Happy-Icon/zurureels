import { isKenyanE164 } from './phone.ts';
import { africasTalkingProvider } from './providers/africastalking.ts';
import { mobileSasaProvider } from './providers/mobilesasa.ts';
import {
  defaultGetEnv,
  type EnvGetter,
  type SmsProviderAdapter,
  type SmsProviderName,
  type SmsSendRequest,
  type SmsSendResult,
} from './types.ts';

const PROVIDERS: Record<SmsProviderName, SmsProviderAdapter> = {
  mobilesasa: mobileSasaProvider,
  africastalking: africasTalkingProvider,
};

function parseProviderName(raw: string | undefined): SmsProviderName | null {
  const val = (raw || '').trim().toLowerCase();
  if (val === 'mobilesasa') return 'mobilesasa';
  if (val === 'africastalking' || val === 'africas_talking' || val === 'at') {
    return 'africastalking';
  }
  return null;
}

export interface SmsGatewayConfig {
  enabled: boolean;
  primary: SmsProviderName;
  fallback: SmsProviderName | null;
  failoverEnabled: boolean;
  internationalProvider: SmsProviderName;
}

export function resolveSmsGatewayConfig(getEnv: EnvGetter = defaultGetEnv): SmsGatewayConfig {
  const enabledRaw = (getEnv('SMS_ENABLED') ?? 'true').trim().toLowerCase();
  const enabled = enabledRaw !== 'false' && enabledRaw !== '0' && enabledRaw !== 'off';

  const primary = parseProviderName(getEnv('SMS_PROVIDER')) ?? 'africastalking';
  const fallbackRaw = (getEnv('SMS_FALLBACK_PROVIDER') || '').trim().toLowerCase();
  const fallback =
    fallbackRaw === 'none' || fallbackRaw === 'off'
      ? null
      : parseProviderName(fallbackRaw) ?? (primary === 'mobilesasa' ? 'africastalking' : 'mobilesasa');

  const failoverRaw = (getEnv('SMS_FAILOVER_ENABLED') ?? 'true').trim().toLowerCase();
  const failoverEnabled = failoverRaw !== 'false' && failoverRaw !== '0' && failoverRaw !== 'off';

  const internationalProvider =
    parseProviderName(getEnv('SMS_INTERNATIONAL_PROVIDER')) ?? 'africastalking';

  return {
    enabled,
    primary,
    fallback: fallback === primary ? null : fallback,
    failoverEnabled,
    internationalProvider,
  };
}

export function getSmsProviderAdapter(name: SmsProviderName): SmsProviderAdapter {
  return PROVIDERS[name];
}

/**
 * Dispatches an SMS through the configured primary provider (Mobile Sasa or Africa's Talking),
 * routing non-Kenyan (+254) numbers to SMS_INTERNATIONAL_PROVIDER (default Africa's Talking)
 * and automatically failing over on retryable/balance/auth errors when SMS_FAILOVER_ENABLED=true.
 */
export async function sendSmsViaGateway(
  req: SmsSendRequest,
  opts?: {
    getEnv?: EnvGetter;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    providers?: Record<SmsProviderName, SmsProviderAdapter>;
  },
): Promise<SmsSendResult> {
  const getEnv = opts?.getEnv ?? defaultGetEnv;
  const providers = opts?.providers ?? PROVIDERS;
  const config = resolveSmsGatewayConfig(getEnv);

  if (!config.enabled) {
    return {
      accepted: false,
      provider: 'disabled',
      trackingId: req.trackingId,
      error: 'SMS dispatch is globally disabled via SMS_ENABLED=false',
      errorKind: 'disabled',
      failoverEligible: false,
    };
  }

  // Route international (non-+254) numbers through SMS_INTERNATIONAL_PROVIDER (default Africa's Talking)
  let primaryName = config.primary;
  if (!isKenyanE164(req.toE164) && config.internationalProvider !== primaryName) {
    const intlAdapter = providers[config.internationalProvider];
    if (intlAdapter?.isConfigured(getEnv)) {
      primaryName = config.internationalProvider;
    }
  }

  const primaryAdapter = providers[primaryName];
  const fallbackName =
    config.failoverEnabled && config.fallback && config.fallback !== primaryName
      ? config.fallback
      : config.failoverEnabled && primaryName !== config.primary
        ? config.primary
        : null;
  const fallbackAdapter = fallbackName ? providers[fallbackName] : null;

  // If primary is unconfigured, try fallback immediately if configured
  if (!primaryAdapter.isConfigured(getEnv)) {
    if (fallbackAdapter && fallbackAdapter.isConfigured(getEnv)) {
      const fbRes = await fallbackAdapter.send(req, opts);
      return {
        ...fbRes,
        usedFallback: true,
        primaryError: `Primary SMS provider (${primaryName}) is not configured`,
      };
    }
    return {
      accepted: false,
      provider: 'unconfigured',
      trackingId: req.trackingId,
      error: `No SMS provider configured (primary=${primaryName})`,
      errorKind: 'unconfigured',
      failoverEligible: false,
    };
  }

  const primaryResult = await primaryAdapter.send(req, opts);
  if (primaryResult.accepted) {
    return { ...primaryResult, usedFallback: false };
  }

  // Failover only when error is eligible (5xx/timeout/429/0402 balance/0401 auth) and never on 0409/0422
  if (
    primaryResult.failoverEligible &&
    fallbackAdapter &&
    fallbackAdapter.isConfigured(getEnv)
  ) {
    const fallbackResult = await fallbackAdapter.send(req, opts);
    return {
      ...fallbackResult,
      usedFallback: true,
      primaryError: `${primaryName}: ${primaryResult.error || 'failed'}`,
    };
  }

  return { ...primaryResult, usedFallback: false };
}
