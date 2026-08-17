/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PaymentAttempt = {
  id: string;
  provider_reference: string;
  amount: number;
  currency: 'KES';
  status: 'created' | 'pending' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  display_text: string | null;
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
  return `+${normalized}`;
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

  // Enforce server-side rate limit: max 5 checkout requests per 60 seconds
  const rl = await checkRateLimit(request, 'checkout_payment', 5, 60, user.id);
  if (!rl.allowed) {
    return json({ error: 'Too many payment requests. Please wait a moment before trying again.' }, 429);
  }

  let input: { quoteId?: string; phone?: string; idempotencyKey?: string };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const rawPhone = input.phone || user.phone || (user.user_metadata?.phone as string | undefined);
  if (!input.quoteId || !rawPhone || !input.idempotencyKey) {
    return json({ error: 'quoteId, phone, and idempotencyKey are required' }, 400);
  }

  let phone: string;
  try {
    phone = normalizeKenyanPhone(rawPhone);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid phone number' }, 400);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: attempt, error: attemptError } = await userClient.rpc('begin_payment_attempt', {
    p_quote_id: input.quoteId,
    p_idempotency_key: input.idempotencyKey,
  }).single<PaymentAttempt>();

  if (attemptError || !attempt) {
    console.error('begin_payment_attempt RPC error:', attemptError);
    return json({ error: attemptError?.message ?? 'Could not prepare payment' }, 409);
  }

  // The same idempotency key always returns the original in-flight attempt.
  if (attempt.status === 'pending' || attempt.status === 'succeeded') {
    return json({
      attemptId: attempt.id,
      reference: attempt.provider_reference,
      status: attempt.status,
      displayText: attempt.display_text,
    });
  }

  const customerEmail = user.email && user.email.includes('@')
    ? user.email
    : `${user.phone ? user.phone.replace(/[^0-9]/g, '') : user.id}@guest.zuru.app`;

  const paystackResponse = await fetch('https://api.paystack.co/charge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: customerEmail,
      amount: attempt.amount,
      currency: attempt.currency,
      reference: attempt.provider_reference,
      mobile_money: { phone, provider: 'mpesa' },
      metadata: { booking_quote_id: input.quoteId, payment_attempt_id: attempt.id },
    }),
  });

  const providerResponse = await paystackResponse.json().catch(() => ({}));
  if (!paystackResponse.ok || providerResponse.status !== true) {
    console.error('Paystack charge failed:', paystackResponse.status, JSON.stringify(providerResponse));

    const failureMessage = String(
      providerResponse.data?.message || providerResponse.message || 'Paystack could not start the charge'
    );

    await admin.rpc('settle_paystack_failure', {
      p_provider_reference: attempt.provider_reference,
      p_failure_code: String(providerResponse.code ?? paystackResponse.status),
      p_failure_message: failureMessage,
      p_paystack_response: providerResponse,
    });

    return json({ error: failureMessage }, 400);
  }

  const data = providerResponse.data ?? {};
  const { error: updateError } = await admin.from('payment_attempts').update({
    status: 'pending',
    provider_status: String(data.status ?? 'pay_offline'),
    display_text: data.display_text ? String(data.display_text) : null,
    provider_response: providerResponse,
  }).eq('id', attempt.id);

  if (updateError) {
    console.error('Failed to update payment_attempts to pending:', updateError);
    return json({ error: 'Payment started but could not be recorded safely' }, 500);
  }

  return json({
    attemptId: attempt.id,
    reference: attempt.provider_reference,
    status: 'pending',
    displayText: data.display_text ?? 'Approve the M-Pesa prompt on your phone.',
  });
});
