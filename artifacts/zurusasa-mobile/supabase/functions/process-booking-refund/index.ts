/// <reference path="../deno.d.ts" />
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

  // Fetch pending refund requests
  const { data: pendingRefunds, error: fetchError } = await admin
    .from('refund_requests')
    .select('id, booking_id, payment_attempt_id, guest_id, amount, currency, reason')
    .eq('status', 'pending')
    .limit(10);

  if (fetchError) {
    console.error('Failed to fetch pending refunds:', fetchError);
    return json({ error: 'Failed to query pending refunds' }, 500);
  }

  if (!pendingRefunds || pendingRefunds.length === 0) {
    return json({ message: 'No pending refunds to process', count: 0 });
  }

  const results: { refundId: string; status: string; providerRefundId?: string; error?: string }[] = [];

  for (const refund of pendingRefunds) {
    try {
      let transactionRef: string | null = null;
      if (refund.payment_attempt_id) {
        const { data: pa } = await admin
          .from('payment_attempts')
          .select('provider_reference, provider_charge_id')
          .eq('id', refund.payment_attempt_id)
          .maybeSingle();
        transactionRef = pa?.provider_reference ?? null;
      }

      if (!transactionRef) {
        throw new Error(`Missing payment transaction reference for refund ${refund.id}`);
      }

      // Mark processing
      await admin
        .from('refund_requests')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', refund.id);

      // Call Paystack Refund API
      const refundResponse = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: transactionRef,
          amount: refund.amount,
          currency: refund.currency,
          customer_note: refund.reason || 'ZuruSasa booking cancellation refund',
          merchant_note: `Refund for booking ${refund.booking_id}`,
        }),
      });

      const providerResult = await refundResponse.json().catch(() => ({}));
      if (!refundResponse.ok || providerResult.status !== true) {
        const failureReason = String(providerResult.message || refundResponse.statusText);

        await admin
          .from('refund_requests')
          .update({
            status: 'failed',
            failure_reason: failureReason,
            provider_response: providerResult,
            processed_at: new Date().toISOString(),
          })
          .eq('id', refund.id);

        results.push({ refundId: refund.id, status: 'failed', error: failureReason });
        continue;
      }

      const data = providerResult.data ?? {};
      const providerRefundId = String(data.id || data.reference || refund.id);

      // Update refund request status to success
      await admin
        .from('refund_requests')
        .update({
          status: 'success',
          provider_refund_id: providerRefundId,
          provider_response: providerResult,
          processed_at: new Date().toISOString(),
        })
        .eq('id', refund.id);

      // Transition booking to refunded
      await admin
        .from('bookings')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('id', refund.booking_id);

      // Record durable lifecycle event
      await admin
        .from('booking_lifecycle_events')
        .insert({
          booking_id: refund.booking_id,
          from_status: 'refund_pending',
          to_status: 'refunded',
          actor_type: 'payment_provider',
          reason: 'Paystack refund processed',
        });

      // Notify Guest of completed refund
      try {
        const refundAmountKES = (Number(refund.amount) / 100).toLocaleString();
        await admin.from('notifications').insert({
          user_id: refund.guest_id,
          type: 'refund_processed',
          title: 'Refund Processed! 💳',
          message: `KES ${refundAmountKES} has been refunded to your original payment account for booking #${refund.booking_id.slice(0, 8).toUpperCase()}.`,
          action_type: 'booking',
          action_id: refund.booking_id,
          is_read: false,
        });
      } catch (notifErr) {
        console.warn('Refund notification warning:', notifErr);
      }

      results.push({ refundId: refund.id, status: 'success', providerRefundId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Error processing refund ${refund.id}:`, errorMessage);
      results.push({ refundId: refund.id, status: 'failed', error: errorMessage });
    }
  }

  return json({ message: 'Refund batch processed', processedCount: results.length, results });
});
