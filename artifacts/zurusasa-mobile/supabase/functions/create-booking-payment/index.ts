/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PaymentChannel = 'mobile_money' | 'card';

type PaymentAttempt = {
  id: string;
  provider_reference: string;
  amount: number;
  currency: 'KES';
  status: 'created' | 'pending' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  display_text: string | null;
  provider_response?: Record<string, unknown> | null;
};

const ALLOWED_APP_REDIRECT_RE =
  /^(zurusasa-mobile|zurusasa|exp):\/\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/;

const PROHIBITED_RAW_PCI_KEY_RE = /^(card|pan|expir|csc|cv[vc])/i;

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

  let input: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Invalid request body' }, 400);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  // PCI-DSS SAQ-A enforcement: never accept raw card numbers, expiries, or security codes
  const hasProhibitedPciField = Object.entries(input).some(
    ([key, value]) => PROHIBITED_RAW_PCI_KEY_RE.test(key) && value != null,
  );
  if (hasProhibitedPciField) {
    return json(
      {
        error:
          'Raw card details are prohibited on this endpoint. Use channel="card" for Paystack Hosted Checkout.',
      },
      400,
    );
  }

  const quoteId = typeof input.quoteId === 'string' ? input.quoteId.trim() : '';
  const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  const rawChannel = typeof input.channel === 'string' ? input.channel.trim() : 'mobile_money';

  if (rawChannel !== 'mobile_money' && rawChannel !== 'card') {
    return json({ error: 'Unsupported payment channel. Must be "mobile_money" or "card".' }, 400);
  }
  const channel: PaymentChannel = rawChannel;

  if (!quoteId || !idempotencyKey) {
    return json({ error: 'quoteId and idempotencyKey are required' }, 400);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: attempt, error: attemptError } = await userClient
    .rpc('begin_payment_attempt', {
      p_quote_id: quoteId,
      p_idempotency_key: idempotencyKey,
    })
    .single<PaymentAttempt>();

  if (attemptError || !attempt) {
    console.error('begin_payment_attempt RPC error:', attemptError);
    return json({ error: attemptError?.message ?? 'Could not prepare payment' }, 409);
  }

  // The same idempotency key always returns the original in-flight or settled attempt.
  if (attempt.status === 'pending' || attempt.status === 'succeeded') {
    const existingProviderData =
      attempt.provider_response && typeof attempt.provider_response === 'object'
        ? ((attempt.provider_response as Record<string, any>).data ?? {})
        : {};
    return json({
      attemptId: attempt.id,
      reference: attempt.provider_reference,
      status: attempt.status,
      channel,
      authorization_url: existingProviderData.authorization_url
        ? String(existingProviderData.authorization_url)
        : null,
      access_code: existingProviderData.access_code
        ? String(existingProviderData.access_code)
        : null,
      displayText: attempt.display_text,
    });
  }

  // Zero-amount (e.g. Free Entry event) reservations settle directly without calling Paystack.
  if (Number(attempt.amount) === 0) {
    const { data: bookingId, error: freeSettleError } = await admin.rpc('settle_paystack_success', {
      p_provider_reference: attempt.provider_reference,
      p_provider_charge_id: 'free_entry',
      p_paystack_response: {
        status: true,
        channel: 'free_entry',
        message: 'Free event reservation confirmed',
      },
    });

    if (freeSettleError) {
      console.error('Free entry settlement error:', freeSettleError);
      await admin.rpc('settle_paystack_failure', {
        p_provider_reference: attempt.provider_reference,
        p_failure_code: 'free_entry_settle_failed',
        p_failure_message: freeSettleError.message || 'Could not confirm free reservation',
        p_paystack_response: { error: freeSettleError.message },
      });
      return json({ error: freeSettleError.message || 'Could not confirm reservation' }, 500);
    }

    return json({
      attemptId: attempt.id,
      bookingId: bookingId ?? null,
      reference: attempt.provider_reference,
      status: 'succeeded',
      channel,
      displayText: 'Reservation confirmed!',
    });
  }

  let phone: string | null = null;
  if (channel === 'mobile_money') {
    const rawPhone =
      (typeof input.phone === 'string' ? input.phone : '') ||
      user.phone ||
      (user.user_metadata?.phone as string | undefined) ||
      '';
    if (!rawPhone) {
      await admin.rpc('settle_paystack_failure', {
        p_provider_reference: attempt.provider_reference,
        p_failure_code: 'missing_phone',
        p_failure_message: 'phone is required for mobile_money payments',
        p_paystack_response: { error: 'phone is required for mobile_money payments' },
      });
      return json({ error: 'phone is required for mobile_money payments' }, 400);
    }
    try {
      phone = normalizeKenyanPhone(rawPhone);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Invalid phone number';
      await admin.rpc('settle_paystack_failure', {
        p_provider_reference: attempt.provider_reference,
        p_failure_code: 'invalid_phone',
        p_failure_message: msg,
        p_paystack_response: { error: msg },
      });
      return json({ error: msg }, 400);
    }
  }

  const customerEmail =
    user.email && user.email.includes('@')
      ? user.email
      : `${user.phone ? user.phone.replace(/[^0-9]/g, '') : user.id}@guest.zuru.app`;

  if (channel === 'card') {
    const requestedCallback =
      typeof input.callbackUrl === 'string' ? input.callbackUrl.trim() : '';
    const safeAppRedirect = ALLOWED_APP_REDIRECT_RE.test(requestedCallback)
      ? requestedCallback
      : 'zurusasa-mobile://payment-callback';

    const paystackCallbackUrl = `${url}/functions/v1/paystack-webhook?callback=1&redirect=${encodeURIComponent(
      safeAppRedirect,
    )}`;

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
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
        channels: ['card'],
        callback_url: paystackCallbackUrl,
        metadata: {
          booking_quote_id: quoteId,
          payment_attempt_id: attempt.id,
          guest_id: user.id,
          channel: 'card',
        },
      }),
    });

    const providerResponse = await paystackResponse.json().catch(() => ({}));
    const initData = providerResponse?.data ?? {};

    if (!paystackResponse.ok || providerResponse.status !== true || !initData.authorization_url) {
      console.error(
        'Paystack hosted card checkout initialization failed:',
        paystackResponse.status,
        JSON.stringify(providerResponse),
      );

      const failureMessage = String(
        initData?.message ||
          providerResponse?.message ||
          'Paystack could not initialize secure card checkout',
      );

      await admin.rpc('settle_paystack_failure', {
        p_provider_reference: attempt.provider_reference,
        p_failure_code: String(providerResponse?.code ?? paystackResponse.status),
        p_failure_message: failureMessage,
        p_paystack_response: providerResponse,
      });

      return json({ error: failureMessage }, 400);
    }

    const displayText = 'Complete card payment in the secure Paystack browser window.';
    const { error: updateError } = await admin
      .from('payment_attempts')
      .update({
        status: 'pending',
        provider_status: 'hosted_checkout',
        display_text: displayText,
        provider_response: providerResponse,
      })
      .eq('id', attempt.id);

    if (updateError) {
      console.error('Failed to update card payment_attempts to pending:', updateError);
      return json({ error: 'Payment started but could not be recorded safely' }, 500);
    }

    return json({
      attemptId: attempt.id,
      reference: attempt.provider_reference,
      status: 'pending',
      channel: 'card',
      authorization_url: String(initData.authorization_url),
      access_code: initData.access_code ? String(initData.access_code) : null,
      displayText,
    });
  }

  // Default: mobile_money (M-Pesa STK Push)
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
      metadata: {
        booking_quote_id: quoteId,
        payment_attempt_id: attempt.id,
        guest_id: user.id,
        channel: 'mobile_money',
      },
    }),
  });

  const providerResponse = await paystackResponse.json().catch(() => ({}));
  if (!paystackResponse.ok || providerResponse.status !== true) {
    console.error('Paystack charge failed:', paystackResponse.status, JSON.stringify(providerResponse));

    const failureMessage = String(
      providerResponse.data?.message || providerResponse.message || 'Paystack could not start the charge',
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
  const { error: updateError } = await admin
    .from('payment_attempts')
    .update({
      status: 'pending',
      provider_status: String(data.status ?? 'pay_offline'),
      display_text: data.display_text ? String(data.display_text) : null,
      provider_response: providerResponse,
    })
    .eq('id', attempt.id);

  if (updateError) {
    console.error('Failed to update payment_attempts to pending:', updateError);
    return json({ error: 'Payment started but could not be recorded safely' }, 500);
  }

  return json({
    attemptId: attempt.id,
    reference: attempt.provider_reference,
    status: 'pending',
    channel: 'mobile_money',
    displayText: data.display_text ?? 'Approve the M-Pesa prompt on your phone.',
  });
});
