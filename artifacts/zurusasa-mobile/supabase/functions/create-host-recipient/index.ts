/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

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

function normalizeKenyanPhone(raw: string) {
  const digits = raw.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  const normalized = digits.startsWith('0')
    ? `254${digits.slice(1)}`
    : digits.startsWith('254')
      ? digits
      : `254${digits}`;

  if (!/^254(?:7|1)\d{8}$/.test(normalized)) {
    throw new Error('Enter a valid Kenyan M-Pesa number (e.g. 0712345678 or 254712345678).');
  }
  return normalized;
}

async function createPaystackRecipient(
  paystackSecret: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const response = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: response.ok && body.status === true,
    status: response.status,
    body,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication is required' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!paystackSecret) return json({ error: 'Payment service is not configured' }, 503);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Authentication is required' }, 401);

  // Enforce Rate Limit: max 5 requests per 60 seconds per user
  const rl = await checkRateLimit(request, 'create_host_recipient', 5, 60, user.id);
  if (!rl.allowed) {
    return json({ error: 'Too many payout configuration attempts. Please wait a moment.' }, 429);
  }

  let input: {
    methodType?: 'mpesa' | 'bank';
    accountName?: string;
    accountNumber?: string;
    bankCode?: string;
  };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!input.accountName || !input.accountNumber) {
    return json({ error: 'accountName and accountNumber are required' }, 400);
  }

  const rawBankCode = (input.bankCode ?? '').trim();
  const isMpesa =
    input.methodType === 'mpesa' ||
    (!input.methodType &&
      (!rawBankCode || rawBankCode.toUpperCase() === 'MPESA' || rawBankCode === '744'));

  let accountNumber: string;
  let bankCode: string;
  let result: { ok: boolean; status: number; body: Record<string, unknown> };

  if (isMpesa) {
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeKenyanPhone(input.accountNumber);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Invalid phone number' }, 400);
    }

    const localPhone = '0' + normalizedPhone.slice(3);
    accountNumber = normalizedPhone;
    bankCode = 'MPESA';

    const basePayload = {
      type: 'mobile_money',
      name: input.accountName.trim(),
      bank_code: 'MPESA',
      currency: 'KES',
      metadata: { host_id: user.id, method_type: 'mpesa' },
    };

    result = await createPaystackRecipient(paystackSecret, {
      ...basePayload,
      account_number: localPhone,
    });
    if (!result.ok) {
      result = await createPaystackRecipient(paystackSecret, {
        ...basePayload,
        account_number: normalizedPhone,
      });
    }
  } else {
    const cleanedAccount = input.accountNumber.replace(/[^0-9A-Za-z]/g, '');
    if (cleanedAccount.length < 6 || cleanedAccount.length > 24) {
      return json({ error: 'Enter a valid bank account number.' }, 400);
    }
    if (!rawBankCode || rawBankCode.toUpperCase() === 'MPESA' || rawBankCode === '744') {
      return json({ error: 'Please select a bank.' }, 400);
    }

    accountNumber = cleanedAccount;
    bankCode = rawBankCode;

    const basePayload = {
      name: input.accountName.trim(),
      account_number: cleanedAccount,
      bank_code: rawBankCode,
      currency: 'KES',
      metadata: { host_id: user.id, method_type: 'bank' },
    };

    result = await createPaystackRecipient(paystackSecret, {
      ...basePayload,
      type: 'kepss',
    });
    if (!result.ok) {
      result = await createPaystackRecipient(paystackSecret, {
        ...basePayload,
        type: 'nuban',
      });
    }
  }

  const providerResponse = result.body;
  if (!result.ok) {
    console.error('Paystack transfer recipient creation failed:', result.status, providerResponse);
    return json({
      error: (providerResponse.message as string | undefined) ?? 'Could not register payout recipient with Paystack'
    }, 400);
  }

  const data = (providerResponse.data ?? {}) as Record<string, unknown>;
  const recipientCode = String(data.recipient_code);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  // Deactivate old active payout recipients for this host
  await admin
    .from('host_payout_recipients')
    .update({ is_active: false })
    .eq('host_id', user.id);

  // Insert new active recipient
  const { data: recipientRow, error: insertError } = await admin
    .from('host_payout_recipients')
    .insert({
      host_id: user.id,
      provider: 'paystack',
      recipient_code: recipientCode,
      account_name: input.accountName.trim(),
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'KES',
      is_active: true,
      metadata: data,
    })
    .select('id, recipient_code, account_name, account_number, bank_code, created_at')
    .single();

  if (insertError) {
    console.error('Failed to store recipient in database:', insertError);
    return json({ error: 'Payout recipient registered with Paystack but could not be saved' }, 500);
  }

  // Backfill and schedule payouts for any existing paid bookings for this host
  let backfilledCount = 0;
  try {
    const { data: backfillRes } = await admin.rpc('schedule_pending_host_payouts', {
      p_host_id: user.id,
    });
    backfilledCount = Number(backfillRes || 0);
  } catch (backfillErr) {
    console.warn('Payout backfill non-fatal warning:', backfillErr);
  }

  return json({
    recipient: recipientRow,
    backfilledPayoutsCount: backfilledCount,
    message: backfilledCount > 0
      ? `Payout account configured and ${backfilledCount} pending booking payout(s) scheduled.`
      : isMpesa
        ? 'Payout M-Pesa account configured successfully.'
        : 'Payout bank account configured successfully.',
  });
});
