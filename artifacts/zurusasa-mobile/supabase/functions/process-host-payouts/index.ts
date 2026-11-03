/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeWorkerOrAdmin } from '../_shared/workerAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');

  if (!url || !serviceRoleKey || !paystackSecret) {
    return json({ error: 'Payment or database service is not configured' }, 503);
  }

  // Enforce strict worker/cron/admin authorization
  const auth = await authorizeWorkerOrAdmin(request, url, anonKey, serviceRoleKey);
  if (!auth.authorized) {
    return json({ error: auth.error || 'Unauthorized' }, auth.status);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  // Complete eligible stays before considering payouts. This keeps completed
  // as the release gate rather than letting a merely-paid booking transfer.
  const { error: completionError } = await admin.rpc('complete_due_bookings');
  if (completionError) {
    console.error('Failed to complete due bookings:', completionError);
    return json({ error: 'Could not finalize completed bookings safely' }, 500);
  }

  // Fetch due payouts scheduled for <= now()
  const { data: duePayouts, error: fetchError } = await admin
    .from('host_payouts')
    .select('id, host_id, booking_id, recipient_code, amount, currency, retry_count, max_retries')
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
      const { data: booking, error: bookingError } = await admin
        .from('bookings')
        .select('status')
        .eq('id', payout.booking_id)
        .maybeSingle();

      if (bookingError || booking?.status !== 'completed') {
        await admin
          .from('host_payouts')
          .update({
            status: 'cancelled',
            failure_reason: 'Payout requires a completed confirmed booking',
          })
          .eq('id', payout.id)
          .eq('status', 'scheduled');
        results.push({ payoutId: payout.id, status: 'cancelled', error: 'Booking is not completed' });
        continue;
      }

      // Optimistic lock: atomically claim payout from 'scheduled' -> 'processing' to prevent concurrent double-transfers
      const { data: claimedPayout } = await admin
        .from('host_payouts')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', payout.id)
        .eq('status', 'scheduled')
        .select('id')
        .maybeSingle();

      if (!claimedPayout) {
        results.push({ payoutId: payout.id, status: 'skipped_concurrent' });
        continue;
      }

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
        const currentRetries = Number(payout.retry_count || 0);
        const maxRetries = Number(payout.max_retries || 3);

        if (currentRetries < maxRetries) {
          // Exponential backoff retry: 1h, 2h, 4h (restore status to 'scheduled')
          const backoffHours = Math.pow(2, currentRetries);
          const nextAttempt = new Date(Date.now() + backoffHours * 3600 * 1000).toISOString();

          await admin
            .from('host_payouts')
            .update({
              status: 'scheduled',
              retry_count: currentRetries + 1,
              scheduled_for: nextAttempt,
              failure_reason: `Attempt ${currentRetries + 1} failed: ${failureReason}`,
              provider_response: providerResult,
            })
            .eq('id', payout.id);

          results.push({ payoutId: payout.id, status: 'retry_scheduled', error: failureReason });
        } else {
          await admin
            .from('host_payouts')
            .update({
              status: 'failed',
              failure_reason: `All ${maxRetries} attempts failed: ${failureReason}`,
              provider_response: providerResult,
              processed_at: new Date().toISOString(),
            })
            .eq('id', payout.id);

          results.push({ payoutId: payout.id, status: 'failed', error: failureReason });
        }
        continue;
      }

      const data = providerResult.data ?? {};
      const transferCode = String(data.transfer_code || reference);

      await admin
        .from('host_payouts')
        .update({
          status: 'success',
          provider_transfer_code: transferCode,
          provider_response: providerResult,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      await admin.from('financial_ledger').insert({
        booking_id: payout.booking_id,
        entry_type: 'host_payout_debit',
        debit_account: 'HOST_ESCROW_PAYABLE',
        credit_account: 'PAYSTACK_BANK_OUTFLOW',
        amount: payout.amount,
        currency: payout.currency,
        metadata: { payout_id: payout.id, transfer_code: transferCode, host_id: payout.host_id },
      });

      try {
        const payoutAmountKES = (Number(payout.amount) / 100).toLocaleString();
        const refId = payout.booking_id ? payout.booking_id.slice(0, 8).toUpperCase() : payout.id.slice(0, 8).toUpperCase();
        await admin.from('notifications').insert({
          user_id: payout.host_id,
          type: 'payout_completed',
          title: 'Payout Sent! 💰',
          message: `KES ${payoutAmountKES} has been transferred to your payout account for booking #${refId}.`,
          action_type: 'payout',
          action_id: payout.id,
          is_read: false,
        });
      } catch (notifEx) {
        console.warn('Payout notification dispatch warning:', notifEx);
      }

      results.push({ payoutId: payout.id, status: 'success', transferCode });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Error executing payout ${payout.id}:`, errorMessage);
      results.push({ payoutId: payout.id, status: 'failed', error: errorMessage });
    }
  }

  return json({ message: 'Payout processing batch finished', processedCount: results.length, results });
});
