import { before, describe, test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

interface CustomSmsSenderMod {
  handleSendSmsHookRequest: (
    req: Request,
    opts?: {
      getEnv?: (key: string) => string | undefined;
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    },
  ) => Promise<Response>;
  verifySendSmsHookSignature: (params: {
    rawBody: string;
    webhookId: string | null;
    webhookTimestamp: string | null;
    webhookSignature: string | null;
    hookSecret: string;
    nowSeconds?: number;
  }) => Promise<{ valid: boolean; reason?: string }>;
}

let hookMod: CustomSmsSenderMod;

function makeEnv(values: Record<string, string | undefined>) {
  return (key: string) => values[key];
}

before(async () => {
  const hookPath = '../../supabase/functions/custom-sms-sender/index.ts';
  hookMod = (await import(hookPath)) as CustomSmsSenderMod;
});

describe('custom-sms-sender Supabase Auth Hook', () => {
  test('normalizes GoTrue phone without leading + and sends via Mobile Sasa v2 returning 200 {}', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, any> = {};

    const mockFetch: typeof fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          status: true,
          responseCode: '0200',
          message: 'Accepted',
          messageId: 'mbs_otp_001',
          cost: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const req = new Request('https://example.supabase.co/functions/v1/custom-sms-sender', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { id: 'usr-1', phone: '254712345678' },
        sms: { otp: '482913' },
      }),
    });

    const res = await hookMod.handleSendSmsHookRequest(req, {
      getEnv: makeEnv({
        SMS_ENABLED: 'true',
        SMS_PROVIDER: 'mobilesasa',
        SMS_FAILOVER_ENABLED: 'true',
        SMS_FALLBACK_PROVIDER: 'africastalking',
        MOBILESASA_API_TOKEN: 'mbs_live_token',
        MOBILESASA_SENDER_ID: 'ZURUSASA',
      }),
      fetchImpl: mockFetch,
    });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), {});
    assert.strictEqual(capturedUrl, 'https://api.mobilesasa.com/v2/send/message');
    assert.strictEqual(capturedBody.phone, '+254712345678');
    assert.strictEqual(capturedBody.senderID, 'ZURUSASA');
    assert.ok(String(capturedBody.message).includes('482913'));
    assert.ok(String(capturedBody.trackingId).startsWith('otp_'));
  });

  test('fails over from Mobile Sasa 0402 balance error to Africa\'s Talking and returns 200 {}', async () => {
    const calls: string[] = [];

    const mockFetch: typeof fetch = (async (url: string | URL | Request) => {
      const target = String(url);
      calls.push(target);
      if (target.includes('mobilesasa.com')) {
        return new Response(
          JSON.stringify({ status: false, responseCode: '0402', message: 'Insufficient balance' }),
          { status: 402, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          SMSMessageData: {
            Message: 'Sent to 1/1 Total Cost: KES 0.8000',
            Recipients: [{ statusCode: 101, status: 'Success', messageId: 'ATXid_123' }],
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const req = new Request('https://example.supabase.co/functions/v1/custom-sms-sender', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { id: 'usr-2', phone: '254712345678' },
        sms: { otp: '991122' },
      }),
    });

    const res = await hookMod.handleSendSmsHookRequest(req, {
      getEnv: makeEnv({
        SMS_ENABLED: 'true',
        SMS_PROVIDER: 'mobilesasa',
        SMS_FAILOVER_ENABLED: 'true',
        SMS_FALLBACK_PROVIDER: 'africastalking',
        MOBILESASA_API_TOKEN: 'mbs_live_token',
        AFRICASTALKING_API_KEY: 'at_key',
        AFRICASTALKING_USERNAME: 'zurusasa',
      }),
      fetchImpl: mockFetch,
    });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), {});
    assert.strictEqual(calls.length, 2);
    assert.ok(calls[0].includes('mobilesasa.com'));
    assert.ok(calls[1].includes('africastalking.com'));
  });

  test('returns HTTP 500 with Supabase Auth Hook error schema when SMS dispatch fails (never masks as 200)', async () => {
    const mockFetch: typeof fetch = (async () =>
      new Response(
        JSON.stringify({ status: false, responseCode: '0401', message: 'Unauthorized token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    const req = new Request('https://example.supabase.co/functions/v1/custom-sms-sender', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { id: 'usr-3', phone: '254712345678' },
        sms: { otp: '555666' },
      }),
    });

    const res = await hookMod.handleSendSmsHookRequest(req, {
      getEnv: makeEnv({
        SMS_ENABLED: 'true',
        SMS_PROVIDER: 'mobilesasa',
        SMS_FAILOVER_ENABLED: 'false',
        MOBILESASA_API_TOKEN: 'mbs_bad_token',
      }),
      fetchImpl: mockFetch,
    });

    assert.strictEqual(res.status, 500);
    const body = (await res.json()) as { error?: { http_code?: number; message?: string } };
    assert.strictEqual(body.error?.http_code, 500);
    assert.ok(body.error?.message?.includes('mobilesasa'));
  });

  test('returns HTTP 400 when phone or otp is missing', async () => {
    const req = new Request('https://example.supabase.co/functions/v1/custom-sms-sender', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: {}, sms: {} }),
    });

    const res = await hookMod.handleSendSmsHookRequest(req, {
      getEnv: makeEnv({}),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { error?: { http_code?: number } };
    assert.strictEqual(body.error?.http_code, 400);
  });

  test('verifies Standard Webhooks v1,whsec_ HMAC-SHA256 signatures accurately', async () => {
    const secretBytes = Buffer.from('super-secret-hook-key-1234567890');
    const hookSecret = `v1,whsec_${secretBytes.toString('base64')}`;
    const rawBody = JSON.stringify({ user: { phone: '254712345678' }, sms: { otp: '123456' } });
    const webhookId = 'msg_test_001';
    const webhookTimestamp = '1795350000';

    const sig = crypto
      .createHmac('sha256', secretBytes)
      .update(`${webhookId}.${webhookTimestamp}.${rawBody}`)
      .digest('base64');

    const ok = await hookMod.verifySendSmsHookSignature({
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature: `v1,${sig}`,
      hookSecret,
      nowSeconds: 1795350020,
    });
    assert.strictEqual(ok.valid, true);

    const bad = await hookMod.verifySendSmsHookSignature({
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature: 'v1,invalidSignatureBase64==',
      hookSecret,
      nowSeconds: 1795350020,
    });
    assert.strictEqual(bad.valid, false);
    assert.strictEqual(bad.reason, 'signature_mismatch');
  });
});
