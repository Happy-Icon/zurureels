/// <reference path="../deno.d.ts" />
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-paystack-signature, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ALLOWED_APP_REDIRECT_RE =
  /^(zurusasa-mobile|zurusasa|exp):\/\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return computedSignature.toLowerCase() === signature.toLowerCase();
  } catch (err) {
    console.error('Error verifying Paystack signature:', err);
    return false;
  }
}

async function computeSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function dispatchPostSettlementNotifications(admin: SupabaseClient, bookingId: string) {
  try {
    // Deduplicate in case both browser callback verification and webhook run near-simultaneously
    const { count: existingCount } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('action_id', bookingId)
      .eq('type', 'payment_success');

    if (existingCount && existingCount > 0) {
      return;
    }

    const { data: bData } = await admin
      .from('bookings')
      .select('id, user_id, experience_id, trip_title, amount, experience:experiences(user_id, title)')
      .eq('id', bookingId)
      .single();

    if (!bData) return;

    const exp = Array.isArray(bData.experience) ? bData.experience[0] : bData.experience;
    const guestId = bData.user_id;
    const hostId = (exp as any)?.user_id;
    const tripTitle = bData.trip_title || (exp as any)?.title || 'Stay';
    const amountStr = `KES ${Number(bData.amount || 0).toLocaleString()}`;

    if (guestId) {
      await admin.from('notifications').insert({
        user_id: guestId,
        type: 'payment_success',
        title: 'Payment Confirmed! 💳',
        message: `Your payment of ${amountStr} for "${tripTitle}" was received. The host will confirm your reservation shortly.`,
        action_type: 'booking',
        action_id: bookingId,
        is_read: false,
      });
    }

    if (hostId && hostId !== guestId) {
      await admin.from('notifications').insert({
        user_id: hostId,
        type: 'booking_request',
        title: 'Payment Received — Review Booking',
        message: `A guest paid ${amountStr} for "${tripTitle}". Review and confirm the reservation in your Host Dashboard.`,
        action_type: 'booking',
        action_id: bookingId,
        is_read: false,
      });
    }
  } catch (notifErr) {
    console.warn('Post-settlement notification error:', notifErr);
  }
}

async function verifyAndSettlePaystackTransaction(
  admin: SupabaseClient,
  paystackSecret: string,
  providerReference: string,
  fallbackChargeId = '',
): Promise<string> {
  // Step 1: Query Paystack verification API for authoritative transaction state
  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(providerReference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const verifyResult = await verifyResponse.json().catch(() => ({}));
  if (!verifyResponse.ok || verifyResult.status !== true) {
    throw new Error(`Paystack verification API failed: ${verifyResult.message || verifyResponse.statusText}`);
  }

  const verifyData = verifyResult.data ?? {};
  if (verifyData.status !== 'success') {
    throw new Error(`Paystack verification status is not success: ${verifyData.status}`);
  }

  if (verifyData.currency !== 'KES') {
    throw new Error(`Invalid transaction currency: expected KES, got ${verifyData.currency}`);
  }

  if (verifyData.reference !== providerReference) {
    throw new Error(`Reference mismatch: expected ${providerReference}, got ${verifyData.reference}`);
  }

  // Step 2: Fetch corresponding payment attempt from database to verify amount
  const { data: attempt, error: attemptError } = await admin
    .from('payment_attempts')
    .select('id, quote_id, amount, currency, status')
    .eq('provider_reference', providerReference)
    .single();

  if (attemptError || !attempt) {
    throw new Error(`Payment attempt not found for reference ${providerReference}`);
  }

  const verifiedAmount = Number(verifyData.amount);
  if (verifiedAmount !== Number(attempt.amount)) {
    throw new Error(`Amount mismatch: stored ${attempt.amount} minor units, verified ${verifiedAmount}`);
  }

  console.log('[SETTLEMENT_START]', {
    quoteId: attempt.quote_id,
    attemptId: attempt.id,
    reference: providerReference,
  });

  // Step 3: Invoke atomic settlement RPC (idempotent via FOR UPDATE row locks)
  const { data: bookingId, error: settleError } = await admin.rpc('settle_paystack_success', {
    p_provider_reference: providerReference,
    p_provider_charge_id: String(verifyData.id ?? fallbackChargeId ?? ''),
    p_paystack_response: verifyResult,
  });

  if (settleError || !bookingId) {
    console.error('[SETTLEMENT_FAILURE]', {
      error: settleError?.message,
      sqlState: settleError?.code,
      quoteId: attempt.quote_id,
      attemptId: attempt.id,
      reference: providerReference,
    });
    throw new Error(`Settlement RPC failed: ${settleError?.message || 'No bookingId returned'}`);
  }

  console.log('[SETTLEMENT_SUCCESS]', {
    bookingId,
    bookingStatus: 'paid_or_confirmed',
    paymentAttemptStatus: 'succeeded',
    quoteStatus: 'consumed',
  });

  await dispatchPostSettlementNotifications(admin, String(bookingId));

  return String(bookingId);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!paystackSecret) {
    console.error('PAYSTACK_SECRET_KEY is not configured in Edge Function secrets');
    return json({ error: 'Webhook service misconfigured' }, 500);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Hosted Card Checkout Redirect Bridge (GET ?callback=1&redirect=...&reference=...)
  if (request.method === 'GET') {
    const reqUrl = new URL(request.url);
    if (reqUrl.searchParams.get('callback') !== '1') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const rl = await checkRateLimit(request, 'paystack_callback', 20, 60);
    const requestedRedirect = (reqUrl.searchParams.get('redirect') || '').trim();
    const safeBaseRedirect = ALLOWED_APP_REDIRECT_RE.test(requestedRedirect)
      ? requestedRedirect
      : 'zurusasa-mobile://payment-callback';

    const reference = (
      reqUrl.searchParams.get('reference') ||
      reqUrl.searchParams.get('trxref') ||
      ''
    ).trim();

    if (rl.allowed && reference && /^[a-zA-Z0-9_-]{6,100}$/.test(reference)) {
      try {
        const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        const { data: attempt } = await admin
          .from('payment_attempts')
          .select('id, status')
          .eq('provider_reference', reference)
          .maybeSingle();

        if (attempt && (attempt.status === 'pending' || attempt.status === 'created')) {
          await verifyAndSettlePaystackTransaction(admin, paystackSecret, reference);
        }
      } catch (verifyErr) {
        // Non-fatal on redirect: Paystack's signed POST webhook remains the primary retryable settler
        console.warn('[CALLBACK_VERIFY_INFO]', verifyErr instanceof Error ? verifyErr.message : String(verifyErr));
      }
    }

    const separator = safeBaseRedirect.includes('?') ? '&' : '?';
    const redirectLocation = reference
      ? `${safeBaseRedirect}${separator}reference=${encodeURIComponent(reference)}`
      : safeBaseRedirect;

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectLocation,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const signature = request.headers.get('x-paystack-signature');
  const rawBody = await request.text();

  const isValidSignature = await verifyPaystackSignature(rawBody, signature, paystackSecret);
  if (!isValidSignature) {
    console.error('Paystack webhook signature verification failed');
    return json({ error: 'Invalid signature' }, 401);
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const payloadSha256 = await computeSha256(rawBody);
  const eventType = String(payload.event ?? 'unknown');
  const data = payload.data ?? {};
  const providerReference = data.reference ? String(data.reference) : null;
  const eventId = data.id ? String(data.id) : null;
  const providerEventKey = `paystack_${eventType}_${eventId || providerReference || payloadSha256.slice(0, 16)}`;

  let eventRecordId: string;

  // Store & deduplicate incoming event
  const { data: eventRecord, error: eventInsertError } = await admin
    .from('payment_events')
    .insert({
      provider: 'paystack',
      provider_event_key: providerEventKey,
      event_type: eventType,
      provider_reference: providerReference,
      payload,
      payload_sha256: payloadSha256,
    })
    .select('id')
    .single();

  if (eventInsertError) {
    // Unique violation means event was already received
    if (eventInsertError.code === '23505') {
      const { data: existingEvent } = await admin
        .from('payment_events')
        .select('id, processed_at, processing_error')
        .eq('provider_event_key', providerEventKey)
        .maybeSingle();

      // If it already succeeded and was processed without error, return already_processed (idempotent 200)
      if (existingEvent?.processed_at && !existingEvent?.processing_error) {
        return json({ status: 'already_processed' }, 200);
      }
      if (existingEvent) {
        eventRecordId = existingEvent.id;
      } else {
        return json({ status: 'already_processed' }, 200);
      }
    } else {
      console.error('Failed to log payment event:', eventInsertError);
      return json({ error: 'Failed to record event' }, 500);
    }
  } else {
    eventRecordId = eventRecord.id;
  }

  try {
    if (eventType === 'charge.success') {
      if (!providerReference) {
        throw new Error('charge.success event payload missing reference');
      }

      console.log('[WEBHOOK_RECEIVED]', {
        event: eventType,
        reference: providerReference,
        amount: data.amount,
      });

      const bookingId = await verifyAndSettlePaystackTransaction(
        admin,
        paystackSecret,
        providerReference,
        String(data.id ?? ''),
      );

      await admin
        .from('payment_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', eventRecordId);

      return json({ status: 'settled', bookingId }, 200);
    } else if (eventType === 'charge.failed') {
      if (providerReference) {
        await admin.rpc('settle_paystack_failure', {
          p_provider_reference: providerReference,
          p_failure_code: String(data.gateway_response || data.status || 'charge_failed'),
          p_failure_message: String(data.message || 'Charge failed'),
          p_paystack_response: payload,
        });
      }

      await admin
        .from('payment_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', eventRecordId);

      return json({ status: 'failed_recorded' }, 200);
    } else if (eventType === 'refund.processed') {
      const refundId = data.id ? String(data.id) : null;
      const transactionRef = data.transaction_reference ? String(data.transaction_reference) : null;

      if (transactionRef) {
        const { data: pa } = await admin
          .from('payment_attempts')
          .select('id, quote_id')
          .eq('provider_reference', transactionRef)
          .maybeSingle();

        if (pa) {
          const { data: bRow } = await admin
            .from('bookings')
            .select('id, user_id, trip_title')
            .eq('payment_attempt_id', pa.id)
            .maybeSingle();

          if (bRow) {
            await admin
              .from('bookings')
              .update({ status: 'refunded', updated_at: new Date().toISOString() })
              .eq('id', bRow.id);

            await admin
              .from('refund_requests')
              .update({
                status: 'success',
                provider_refund_id: refundId,
                processed_at: new Date().toISOString(),
              })
              .eq('booking_id', bRow.id);

            await admin
              .from('booking_lifecycle_events')
              .insert({
                booking_id: bRow.id,
                from_status: 'refund_pending',
                to_status: 'refunded',
                actor_type: 'payment_provider',
                reason: 'Paystack refund confirmed',
              });

            // Notify Guest
            await admin.from('notifications').insert({
              user_id: bRow.user_id,
              type: 'refund_processed',
              title: 'Refund Completed! 💳',
              message: `Your refund for "${bRow.trip_title || 'your reservation'}" has been processed successfully.`,
              action_type: 'booking',
              action_id: bRow.id,
              is_read: false,
            });
          }
        }
      }

      await admin
        .from('payment_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', eventRecordId);

      return json({ status: 'refund_settled' }, 200);
    } else {
      // Unhandled event types (e.g. transfer updates, subscription events)
      await admin
        .from('payment_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', eventRecordId);

      return json({ status: 'ignored' }, 200);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Error processing webhook event ${providerEventKey}:`, errorMessage);

    await admin
      .from('payment_events')
      .update({ processing_error: errorMessage })
      .eq('id', eventRecordId);

    // Return 500 status so Paystack knows the webhook delivery failed and will retry
    return json({ error: errorMessage }, 500);
  }
});
