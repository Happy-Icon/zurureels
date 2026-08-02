import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  let input: { accountName?: string; accountNumber?: string; bankCode?: string };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!input.accountName || !input.accountNumber) {
    return json({ error: 'accountName and accountNumber are required' }, 400);
  }

  let accountNumber: string;
  try {
    accountNumber = normalizeKenyanPhone(input.accountNumber);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Invalid phone number' }, 400);
  }

  const bankCode = input.bankCode ?? 'MPESA';

  // Call Paystack Transfer Recipient API
  const paystackResponse = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'mobile_money',
      name: input.accountName.trim(),
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'KES',
      metadata: { host_id: user.id },
    }),
  });

  const providerResponse = await paystackResponse.json().catch(() => ({}));
  if (!paystackResponse.ok || providerResponse.status !== true) {
    console.error('Paystack transfer recipient creation failed:', paystackResponse.status, providerResponse);
    return json({
      error: providerResponse.message ?? 'Could not register payout recipient with Paystack'
    }, 400);
  }

  const data = providerResponse.data ?? {};
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

  return json({
    recipient: recipientRow,
    message: 'Payout M-Pesa account configured successfully.',
  });
});
