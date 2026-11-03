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

  let body: { bookingId?: string } = {};
  try {
    const raw = await request.text();
    if (raw.trim().length > 0) {
      body = JSON.parse(raw);
    }
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400);
  }

  const scopedBookingId = typeof body.bookingId === 'string' && body.bookingId.trim().length > 0
    ? body.bookingId.trim()
    : null;

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const workerAuth = await authorizeWorkerOrAdmin(request, url, anonKey, serviceRoleKey);

  // Mode A: Full batch refund run requires CRON_SECRET / service_role / admin JWT
  if (!scopedBookingId && !workerAuth.authorized) {
    return json({ error: workerAuth.error || 'Unauthorized' }, workerAuth.status);
  }

  // Mode B: Scoped single-booking run allows worker/admin OR the authenticated booking guest/host
  let callerUserId: string | null = workerAuth.userId || null;
  if (scopedBookingId && !workerAuth.authorized) {
    const authHeader = request.headers.get('authorization')?.trim() || '';
    if (!authHeader || !anonKey) {
      return json({ error: 'Authentication required' }, 401);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Authentication required' }, 401);
    }
    callerUserId = user.id;

    // Verify caller owns this booking as Guest or Host
    const { data: bookingRow } = await admin
      .from('bookings')
      .select('id, user_id, quote_id, experience_id')
      .eq('id', scopedBookingId)
      .maybeSingle();

    if (!bookingRow) {
      return json({ error: 'Booking not found' }, 404);
    }

    let isBookingParticipant = bookingRow.user_id === callerUserId;

    if (!isBookingParticipant && bookingRow.quote_id) {
      const { data: quoteRow } = await admin
        .from('booking_quotes')
        .select('host_id, guest_id')
        .eq('id', bookingRow.quote_id)
        .maybeSingle();
      if (quoteRow?.host_id === callerUserId || quoteRow?.guest_id === callerUserId) {
        isBookingParticipant = true;
      }
    }

    if (!isBookingParticipant && bookingRow.experience_id) {
      const { data: expRow } = await admin
        .from('experiences')
        .select('user_id')
        .eq('id', bookingRow.experience_id)
        .maybeSingle();
      if (expRow?.user_id === callerUserId) {
        isBookingParticipant = true;
      }
    }

    if (!isBookingParticipant) {
      return json({ error: 'Forbidden: not authorized to trigger refund for this booking' }, 403);
    }
  }

  // Query pending refund requests (either scoped to bookingId or batch limit 10)
  let refundQuery = admin
    .from('refund_requests')
    .select('id, booking_id, payment_attempt_id, guest_id, amount, currency, reason')
    .eq('status', 'pending');

  if (scopedBookingId) {
    refundQuery = refundQuery.eq('booking_id', scopedBookingId).limit(1);
  } else {
    refundQuery = refundQuery.limit(10);
  }

  const { data: pendingRefunds, error: fetchError } = await refundQuery;

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
      // Optimistic lock: atomically claim refund from 'pending' -> 'processing' to prevent duplicate refunds
      const { data: claimedRefund } = await admin
        .from('refund_requests')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', refund.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (!claimedRefund) {
        results.push({ refundId: refund.id, status: 'skipped_concurrent' });
        continue;
      }

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
        await admin
          .from('refund_requests')
          .update({
            status: 'failed',
            failure_reason: `Missing payment transaction reference for refund ${refund.id}`,
            processed_at: new Date().toISOString(),
          })
          .eq('id', refund.id);
        throw new Error(`Missing payment transaction reference for refund ${refund.id}`);
      }

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

      await admin
        .from('refund_requests')
        .update({
          status: 'success',
          provider_refund_id: providerRefundId,
          provider_response: providerResult,
          processed_at: new Date().toISOString(),
        })
        .eq('id', refund.id);

      await admin
        .from('bookings')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('id', refund.booking_id);

      await admin
        .from('booking_lifecycle_events')
        .insert({
          booking_id: refund.booking_id,
          from_status: 'refund_pending',
          to_status: 'refunded',
          actor_type: 'payment_provider',
          reason: 'Paystack refund processed',
        });

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
