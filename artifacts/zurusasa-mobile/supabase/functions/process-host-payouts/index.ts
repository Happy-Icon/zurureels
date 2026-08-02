import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!paystackSecret) return json({ error: 'Payment service is not configured' }, 503);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  // Fetch due payouts scheduled for <= now()
  const { data: duePayouts, error: fetchError } = await admin
    .from('host_payouts')
    .select('id, host_id, booking_id, recipient_code, amount, currency')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .limit(20);

  if (fetchError) {
    console.error('Failed to fetch due payouts:', fetchError);
    return json({ error: 'Failed to query due payouts' }, 500);
  }

  if (!duePayouts || duePayouts.length === 0) {
    return json({ message: 'No due payouts to process', count: 0 });
  }

  const results: { payoutId: string; status: string; transferCode?: string; error?: string }[] = [];

  for (const payout of duePayouts) {
    try {
      const reference = `payout_${payout.id.replace(/-/g, '')}`;

      const transferResponse = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          reason: `ZuruReels Host Payout for booking ${payout.booking_id}`,
          amount: payout.amount,
          recipient: payout.recipient_code,
          reference,
          currency: payout.currency,
        }),
      });

      const providerResult = await transferResponse.json().catch(() => ({}));
      if (!transferResponse.ok || providerResult.status !== true) {
        const failureReason = String(providerResult.message || transferResponse.statusText);

        await admin
          .from('host_payouts')
          .update({
            status: 'failed',
            failure_reason: failureReason,
            provider_response: providerResult,
            processed_at: new Date().toISOString(),
          })
          .eq('id', payout.id);

        results.push({ payoutId: payout.id, status: 'failed', error: failureReason });
        continue;
      }

      const data = providerResult.data ?? {};
      const transferCode = String(data.transfer_code || reference);

      // Update payout status to success / processing
      await admin
        .from('host_payouts')
        .update({
          status: 'success',
          provider_transfer_code: transferCode,
          provider_response: providerResult,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      // Record double-entry ledger entry for payout debit
      await admin.from('financial_ledger').insert({
        booking_id: payout.booking_id,
        entry_type: 'host_payout_debit',
        debit_account: 'HOST_ESCROW_PAYABLE',
        credit_account: 'PAYSTACK_BANK_OUTFLOW',
        amount: payout.amount,
        currency: payout.currency,
        metadata: { payout_id: payout.id, transfer_code: transferCode, host_id: payout.host_id },
      });

      results.push({ payoutId: payout.id, status: 'success', transferCode });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Error executing payout ${payout.id}:`, errorMessage);
      results.push({ payoutId: payout.id, status: 'failed', error: errorMessage });
    }
  }

  return json({ message: 'Payout processing batch finished', processedCount: results.length, results });
});
