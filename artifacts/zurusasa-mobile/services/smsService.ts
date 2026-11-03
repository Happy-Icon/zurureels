import { supabase } from '@/lib/supabase';

/**
 * ZuruSasa SMS Notification Service
 * Validates E.164 phone numbers and dispatches transactional SMS strictly via
 * the authenticated 'dispatch-notification' Edge Function (server-side Africa's Talking).
 */

export interface E164ValidationResult {
  valid: boolean;
  e164: string;
  error?: string;
}

export interface SendSmsParams {
  userId: string;
  phone: string;
  message: string;
  notificationType?: string;
}

export interface SendSmsResult {
  success: boolean;
  formattedPhone: string;
  provider: string;
  httpStatus?: number;
  latencyMs: number;
  providerResponse?: any;
  error?: string;
  errorCode?: string;
}

/**
 * Validates and formats a raw phone string into standard E.164 format.
 * Examples:
 *  - "0712345678" -> "+254712345678"
 *  - "254712345678" -> "+254712345678"
 *  - "+254 712 345 678" -> "+254712345678"
 */
export function formatToE164(rawPhone: string, defaultCountryCode = '254'): E164ValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, e164: '', error: 'No phone number provided' };
  }

  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');

  if (!cleaned) {
    return { valid: false, e164: '', error: 'Phone number contains no numeric digits' };
  }

  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = `+${defaultCountryCode}${cleaned.slice(1)}`;
  } else if (!cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }

  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    return {
      valid: false,
      e164: cleaned,
      error: `Phone number "${rawPhone}" is not in valid E.164 format (expected e.g. +254712345678)`,
    };
  }

  return { valid: true, e164: cleaned };
}

export const smsService = {
  /**
   * Dispatches an SMS message via server-side Africa's Talking ('dispatch-notification' Edge Function)
   * without ever abusing auth OTP login codes.
   */
  async sendSMS(params: SendSmsParams): Promise<SendSmsResult> {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    const notificationId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const phoneCheck = formatToE164(params.phone);
    if (!phoneCheck.valid) {
      const latencyMs = Math.round(performance.now() - startTime);
      const failureResult: SendSmsResult = {
        success: false,
        formattedPhone: params.phone,
        provider: 'E164_VALIDATOR',
        latencyMs,
        error: phoneCheck.error || 'Invalid phone format',
        errorCode: 'INVALID_E164_FORMAT',
      };

      console.error(
        `[SMS_FAILED] userId=${params.userId} phone=${params.phone} latency=${latencyMs}ms error="${failureResult.error}" timestamp=${timestamp}`,
      );

      return failureResult;
    }

    const formattedPhone = phoneCheck.e164;
    const notifType = params.notificationType || 'account_activity';

    console.log(
      `[SMS_REQUEST] notificationId=${notificationId} userId=${params.userId} phone=${formattedPhone} type=${notifType} timestamp=${timestamp}`,
    );

    try {
      const { data, error } = await supabase.functions.invoke('dispatch-notification', {
        body: {
          recipientId: params.userId,
          type: notifType,
          title: 'ZuruSasa Alert',
          message: params.message,
          recipientPhone: formattedPhone,
          createInApp: false,
          sendPush: false,
          sendSms: true,
        },
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const smsPayload = data?.sms;

      if (error || !smsPayload?.sent) {
        const providerName = smsPayload?.provider || 'unconfigured';
        const errorMsg =
          smsPayload?.error ||
          data?.error ||
          error?.message ||
          'SMS gateway endpoint is not configured';

        const failureResult: SendSmsResult = {
          success: false,
          formattedPhone,
          provider: providerName,
          httpStatus: smsPayload?.httpStatus,
          latencyMs,
          error: errorMsg,
          errorCode: providerName === 'unconfigured' ? 'SMS_UNCONFIGURED' : 'SMS_DISPATCH_FAILED',
          providerResponse: smsPayload ?? data,
        };

        console.warn(
          `[SMS_FAILED] notificationId=${notificationId} userId=${params.userId} provider=${providerName} latency=${latencyMs}ms error="${errorMsg}" timestamp=${timestamp}`,
        );

        return failureResult;
      }

      const successResult: SendSmsResult = {
        success: true,
        formattedPhone,
        provider: smsPayload.provider || 'AfricasTalking',
        httpStatus: smsPayload.httpStatus ?? 200,
        latencyMs,
        providerResponse: smsPayload,
      };

      console.log(
        `[SMS_SENT] notificationId=${notificationId} userId=${params.userId} provider=${successResult.provider} latency=${latencyMs}ms timestamp=${timestamp}`,
      );

      return successResult;
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMsg = err?.message || 'Error occurred while executing SMS notification pipeline';

      return {
        success: false,
        formattedPhone,
        provider: 'unconfigured',
        latencyMs,
        error: errorMsg,
        errorCode: 'SMS_GATEWAY_EXCEPTION',
      };
    }
  },
};
