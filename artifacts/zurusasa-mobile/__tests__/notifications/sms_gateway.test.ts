import { before, describe, test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

interface PhoneMod {
  formatToE164: (raw: string | null | undefined, defaultCountryCode?: string) => {
    valid: boolean;
    e164: string;
    error?: string;
  };
  isKenyanE164: (e164: string) => boolean;
  maskPhoneForLogs: (phone: string) => string;
}

interface Gsm7Mod {
  isGsm7: (text: string) => boolean;
  sanitizeSmsText: (raw: string, maxChars?: number, preserveTrailingRef?: string) => string;
  estimateSmsParts: (text: string) => number;
}

interface MobileSasaMod {
  mobileSasaProvider: {
    name: 'mobilesasa';
    isConfigured: (getEnv?: (k: string) => string | undefined) => boolean;
    send: (req: any, opts?: any) => Promise<any>;
    lookupDlr: (params: any, opts?: any) => Promise<any>;
  };
  normalizeMobileSasaDlrStatus: (raw: unknown) => string;
  verifyMobileSasaWebhookSignature: (params: {
    rawBody: string;
    signatureHeader: string | null;
    secretHeader?: string | null;
    webhookSecret: string;
    nowSeconds?: number;
    maxAgeSeconds?: number;
  }) => Promise<{ valid: boolean; reason?: string; timestamp?: number }>;
}

interface AfricasTalkingMod {
  africasTalkingProvider: {
    name: 'africastalking';
    isConfigured: (getEnv?: (k: string) => string | undefined) => boolean;
    send: (req: any, opts?: any) => Promise<any>;
  };
}

interface GatewayMod {
  resolveSmsGatewayConfig: (getEnv?: (k: string) => string | undefined) => any;
  sendSmsViaGateway: (req: any, opts?: any) => Promise<any>;
}

let phoneMod: PhoneMod;
let gsm7Mod: Gsm7Mod;
let mobileSasaMod: MobileSasaMod;
let atMod: AfricasTalkingMod;
let gatewayMod: GatewayMod;

function makeEnv(values: Record<string, string | undefined>) {
  return (key: string) => values[key];
}

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

before(async () => {
  const phonePath = '../../supabase/functions/_shared/sms/phone.ts';
  const gsm7Path = '../../supabase/functions/_shared/sms/gsm7.ts';
  const mobileSasaPath = '../../supabase/functions/_shared/sms/providers/mobilesasa.ts';
  const atPath = '../../supabase/functions/_shared/sms/providers/africastalking.ts';
  const gatewayPath = '../../supabase/functions/_shared/sms/smsGateway.ts';
  phoneMod = (await import(phonePath)) as PhoneMod;
  gsm7Mod = (await import(gsm7Path)) as Gsm7Mod;
  mobileSasaMod = (await import(mobileSasaPath)) as MobileSasaMod;
  atMod = (await import(atPath)) as AfricasTalkingMod;
  gatewayMod = (await import(gatewayPath)) as GatewayMod;
});

describe('SMS Phone Normalization (E.164 & Kenyan 9-Digit Fix)', () => {
  test('normalizes all Kenyan mobile formats including 9-digit local numbers without +7 corruption', () => {
    assert.deepStrictEqual(phoneMod.formatToE164('0712345678'), { valid: true, e164: '+254712345678' });
    assert.deepStrictEqual(phoneMod.formatToE164('0112345678'), { valid: true, e164: '+254112345678' });
    assert.deepStrictEqual(phoneMod.formatToE164('712345678'), { valid: true, e164: '+254712345678' });
    assert.deepStrictEqual(phoneMod.formatToE164('112345678'), { valid: true, e164: '+254112345678' });
    assert.deepStrictEqual(phoneMod.formatToE164('254712345678'), { valid: true, e164: '+254712345678' });
    assert.deepStrictEqual(phoneMod.formatToE164('+254 712 345 678'), { valid: true, e164: '+254712345678' });
    assert.deepStrictEqual(phoneMod.formatToE164('+2540712345678'), { valid: true, e164: '+254712345678' });
    assert.deepStrictEqual(phoneMod.formatToE164('00254712345678'), { valid: true, e164: '+254712345678' });
    assert.strictEqual(phoneMod.isKenyanE164('+254712345678'), true);
    assert.strictEqual(phoneMod.isKenyanE164('+447911123456'), false);
  });

  test('preserves valid international E.164 numbers and rejects invalid numbers', () => {
    assert.deepStrictEqual(phoneMod.formatToE164('+447911123456'), { valid: true, e164: '+447911123456' });
    assert.deepStrictEqual(phoneMod.formatToE164('+12025550199'), { valid: true, e164: '+12025550199' });
    assert.strictEqual(phoneMod.formatToE164('12345').valid, false);
    assert.strictEqual(phoneMod.formatToE164('+254912345678').valid, false);
    assert.strictEqual(phoneMod.formatToE164('').valid, false);
    assert.strictEqual(phoneMod.maskPhoneForLogs('+254712345678'), '+25471***678');
  });
});

describe('GSM-7 SMS Sanitization & Length Budget', () => {
  test('strips emojis, converts smart punctuation, stays <= 160 chars, and preserves trailing booking ref', () => {
    const dirty = 'ZuruSasa 🎉: Booking for “Diani Oceanfront Luxury Villa & Resort Experience” — confirmed! Open Trips for directions & your arrival PIN right now…';
    const clean = gsm7Mod.sanitizeSmsText(dirty, 160, 'Ref #A1B2C3D4');
    assert.strictEqual(gsm7Mod.isGsm7(clean), true);
    assert.ok(clean.length <= 160, `Expected <= 160 chars, got ${clean.length}`);
    assert.ok(clean.endsWith('Ref #A1B2C3D4'), `Expected trailing ref preserved, got: ${clean}`);
    assert.strictEqual(gsm7Mod.estimateSmsParts(clean), 1);
  });
});

describe('Mobile Sasa Provider Adapter & HMAC Webhook Security', () => {
  test('POST /v2/send/message sends expected Bearer token, senderID, phone, message, trackingId and parses cost', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    const fakeFetch: typeof fetch = async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return mockResponse({
        status: true,
        responseCode: '0200',
        message: 'Accepted',
        messageId: 'ms-msg-9911',
        cost: 1,
      });
    };

    const res = await mobileSasaMod.mobileSasaProvider.send(
      {
        toE164: '+254712345678',
        text: 'ZuruSasa: Booking confirmed Ref #1234ABCD',
        trackingId: 'deliv-uuid-1',
      },
      {
        getEnv: makeEnv({
          MOBILESASA_API_TOKEN: 'mbs_test_token',
          MOBILESASA_SENDER_ID: 'MOBILESASA',
        }),
        fetchImpl: fakeFetch,
      },
    );

    assert.strictEqual(capturedUrl, 'https://api.mobilesasa.com/v2/send/message');
    assert.strictEqual(capturedHeaders.authorization, 'Bearer mbs_test_token');
    assert.deepStrictEqual(capturedBody, {
      senderID: 'MOBILESASA',
      phone: '+254712345678',
      message: 'ZuruSasa: Booking confirmed Ref #1234ABCD',
      trackingId: 'deliv-uuid-1',
    });
    assert.strictEqual(res.accepted, true);
    assert.strictEqual(res.provider, 'mobilesasa');
    assert.strictEqual(res.providerMessageId, 'ms-msg-9911');
    assert.strictEqual(res.costParts, 1);
  });

  test('classifies 0409 duplicate, 0402 low balance, 0422 validation, and 500 server errors accurately', async () => {
    const env = makeEnv({ MOBILESASA_API_TOKEN: 'mbs_test', MOBILESASA_SENDER_ID: 'MOBILESASA' });

    const dup = await mobileSasaMod.mobileSasaProvider.send(
      { toE164: '+254712345678', text: 'hi', trackingId: 't1' },
      { getEnv: env, fetchImpl: async () => mockResponse({ status: false, responseCode: '0409', message: 'Duplicate' }, 409) },
    );
    assert.strictEqual(dup.errorKind, 'duplicate_blocked');
    assert.strictEqual(dup.failoverEligible, false);

    const lowBal = await mobileSasaMod.mobileSasaProvider.send(
      { toE164: '+254712345678', text: 'hi', trackingId: 't2' },
      { getEnv: env, fetchImpl: async () => mockResponse({ status: false, responseCode: '0402', message: 'Low balance' }, 200) },
    );
    assert.strictEqual(lowBal.errorKind, 'retryable');
    assert.strictEqual(lowBal.failoverEligible, true);

    const invalid = await mobileSasaMod.mobileSasaProvider.send(
      { toE164: '+254712345678', text: 'hi', trackingId: 't3' },
      { getEnv: env, fetchImpl: async () => mockResponse({ status: false, responseCode: '0422', message: 'Invalid phone' }, 422) },
    );
    assert.strictEqual(invalid.errorKind, 'permanent');
    assert.strictEqual(invalid.failoverEligible, false);

    const serverErr = await mobileSasaMod.mobileSasaProvider.send(
      { toE164: '+254712345678', text: 'hi', trackingId: 't4' },
      { getEnv: env, fetchImpl: async () => mockResponse({ message: 'Internal Error' }, 500) },
    );
    assert.strictEqual(serverErr.errorKind, 'retryable');
    assert.strictEqual(serverErr.failoverEligible, true);
  });

  test('verifies X-MobileSasa-Signature HMAC-SHA256 on raw body and blocks tampering or expired replay', async () => {
    const secret = 'whsec_test_mobilesasa_secret';
    const rawBody = '{"trackingId":"deliv-1","messageId":"ms-1","status":"DELIVRD"}';
    const nowSec = 1763800000;
    const validSig = crypto
      .createHmac('sha256', secret)
      .update(`${nowSec}.${rawBody}`)
      .digest('hex');

    const ok = await mobileSasaMod.verifyMobileSasaWebhookSignature({
      rawBody,
      signatureHeader: `t=${nowSec},v1=${validSig}`,
      secretHeader: secret,
      webhookSecret: secret,
      nowSeconds: nowSec + 10,
    });
    assert.strictEqual(ok.valid, true);

    const tampered = await mobileSasaMod.verifyMobileSasaWebhookSignature({
      rawBody: rawBody.replace('DELIVRD', 'UNDELIV'),
      signatureHeader: `t=${nowSec},v1=${validSig}`,
      secretHeader: secret,
      webhookSecret: secret,
      nowSeconds: nowSec + 10,
    });
    assert.strictEqual(tampered.valid, false);
    assert.strictEqual(tampered.reason, 'signature_mismatch');

    const expired = await mobileSasaMod.verifyMobileSasaWebhookSignature({
      rawBody,
      signatureHeader: `t=${nowSec - 600},v1=${validSig}`,
      secretHeader: secret,
      webhookSecret: secret,
      nowSeconds: nowSec,
    });
    assert.strictEqual(expired.valid, false);
    assert.strictEqual(expired.reason, 'signature_timestamp_expired');

    const badSecret = await mobileSasaMod.verifyMobileSasaWebhookSignature({
      rawBody,
      signatureHeader: `t=${nowSec},v1=${validSig}`,
      secretHeader: 'wrong_secret',
      webhookSecret: secret,
      nowSeconds: nowSec + 10,
    });
    assert.strictEqual(badSecret.valid, false);
    assert.strictEqual(badSecret.reason, 'invalid_secret_header');
  });

  test('lookupDlr parses live Mobile Sasa nested dlr + top-level deliveryStatus/reference payload', async () => {
    const res = await mobileSasaMod.mobileSasaProvider.lookupDlr(
      { trackingId: 'b2679311-4c60-4d63-8346-4a307378c9e5' },
      {
        getEnv: makeEnv({ MOBILESASA_API_TOKEN: 'mbs_test' }),
        fetchImpl: async () =>
          mockResponse({
            dlr: {
              msisdn: '254704447256',
              gateway: 'safaricom',
              description: 'DeliveredToTerminal',
              tracking_id: 'b2679311-4c60-4d63-8346-4a307378c9e5',
              delivery_code: '0',
            },
            cost: '0.60',
            status: 'Delivered',
            reference: '773c9fe0-b0da-463b-b4ff-30451630b38f',
            trackingId: 'b2679311-4c60-4d63-8346-4a307378c9e5',
            deliveryStatus: 'DeliveredToTerminal',
          }),
      },
    );
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.normalizedStatus, 'delivered');
    assert.strictEqual(res.rawStatus, 'DeliveredToTerminal');
    assert.strictEqual(res.providerMessageId, '773c9fe0-b0da-463b-b4ff-30451630b38f');
  });
});

describe("Dual-Provider SMS Gateway (Mobile Sasa + Preserved Africa's Talking)", () => {
  test('routes Kenyan SMS to Mobile Sasa, fails over to Africa Talking on 500/0402, never fails over on 0409, and routes international SMS to AT', async () => {
    const env = makeEnv({
      SMS_PROVIDER: 'mobilesasa',
      SMS_FALLBACK_PROVIDER: 'africastalking',
      SMS_FAILOVER_ENABLED: 'true',
      SMS_INTERNATIONAL_PROVIDER: 'africastalking',
      MOBILESASA_API_TOKEN: 'mbs_test',
      MOBILESASA_SENDER_ID: 'MOBILESASA',
      AFRICASTALKING_API_KEY: 'at_key',
      AFRICASTALKING_USERNAME: 'zurusasa',
    });

    // 1. Failover on Mobile Sasa 0402 -> Africa's Talking succeeds
    const failoverRes = await gatewayMod.sendSmsViaGateway(
      { toE164: '+254712345678', text: 'Test booking', trackingId: 'trk-1' },
      {
        getEnv: env,
        fetchImpl: async (url: string | URL | Request) => {
          if (String(url).includes('mobilesasa.com')) {
            return mockResponse({ status: false, responseCode: '0402', message: 'Low balance' }, 200);
          }
          return mockResponse({
            SMSMessageData: {
              Recipients: [{ statusCode: 101, status: 'Success', messageId: 'ATXid_123' }],
            },
          });
        },
      },
    );
    assert.strictEqual(failoverRes.accepted, true);
    assert.strictEqual(failoverRes.provider, 'africastalking');
    assert.strictEqual(failoverRes.providerMessageId, 'ATXid_123');
    assert.strictEqual(failoverRes.usedFallback, true);

    // 2. No failover on Mobile Sasa 0409 duplicate
    let atCalled = false;
    const dupRes = await gatewayMod.sendSmsViaGateway(
      { toE164: '+254712345678', text: 'Test booking', trackingId: 'trk-2' },
      {
        getEnv: env,
        fetchImpl: async (url: string | URL | Request) => {
          if (String(url).includes('africastalking.com')) atCalled = true;
          return mockResponse({ status: false, responseCode: '0409', message: 'Duplicate' }, 409);
        },
      },
    );
    assert.strictEqual(dupRes.accepted, false);
    assert.strictEqual(dupRes.errorKind, 'duplicate_blocked');
    assert.strictEqual(atCalled, false);

    // 3. International non-+254 routes directly to Africa's Talking
    let msCalledForIntl = false;
    const intlRes = await gatewayMod.sendSmsViaGateway(
      { toE164: '+447911123456', text: 'Welcome to Diani', trackingId: 'trk-3' },
      {
        getEnv: env,
        fetchImpl: async (url: string | URL | Request) => {
          if (String(url).includes('mobilesasa.com')) msCalledForIntl = true;
          return mockResponse({
            SMSMessageData: {
              Recipients: [{ statusCode: 101, status: 'Success', messageId: 'ATXid_intl' }],
            },
          });
        },
      },
    );
    assert.strictEqual(intlRes.accepted, true);
    assert.strictEqual(intlRes.provider, 'africastalking');
    assert.strictEqual(msCalledForIntl, false);

    // 4. Global kill-switch SMS_ENABLED=false skips safely
    const disabledRes = await gatewayMod.sendSmsViaGateway(
      { toE164: '+254712345678', text: 'Test', trackingId: 'trk-4' },
      { getEnv: makeEnv({ SMS_ENABLED: 'false', SMS_PROVIDER: 'mobilesasa', MOBILESASA_API_TOKEN: 'mbs_test' }) },
    );
    assert.strictEqual(disabledRes.accepted, false);
    assert.strictEqual(disabledRes.errorKind, 'disabled');
  });

  test("preserves Africa's Talking sandbox switching when SMS_PROVIDER=africastalking", async () => {
    let capturedEndpoint = '';
    const res = await atMod.africasTalkingProvider.send(
      { toE164: '+254712345678', text: 'Hello', trackingId: 'trk-at' },
      {
        getEnv: makeEnv({
          AFRICASTALKING_API_KEY: 'sandbox_key',
          AFRICASTALKING_USERNAME: 'sandbox',
        }),
        fetchImpl: async (url: string | URL | Request) => {
          capturedEndpoint = String(url);
          return mockResponse({
            SMSMessageData: {
              Recipients: [{ statusCode: 100, status: 'Processed', messageId: 'ATXid_sbx' }],
            },
          });
        },
      },
    );
    assert.strictEqual(capturedEndpoint, 'https://api.sandbox.africastalking.com/version1/messaging');
    assert.strictEqual(res.accepted, true);
    assert.strictEqual(res.providerMessageId, 'ATXid_sbx');
  });
});
