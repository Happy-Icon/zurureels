/// <reference path="../deno.d.ts" />
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import {
  enqueueNotificationEvent,
  kickNotificationQueueAsync,
} from '../_shared/notificationOrchestrator.ts';

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
    const { data: bData } = await admin
      .from('bookings')
      .select(
        'id, user_id, experience_id, trip_title, amount, status, check_in, check_out, terms_snapshot, quote:booking_quotes(host_id), experience:experiences(user_id, title, booking_mode, timezone)',
      )
      .eq('id', bookingId)
      .single();

    if (!bData) return;

    const exp = Array.isArray(bData.experience) ? bData.experience[0] : bData.experience;
    const quote = Array.isArray((bData as any).quote) ? (bData as any).quote[0] : (bData as any).quote;
    const guestId = bData.user_id;
    const hostId = quote?.host_id || (exp as any)?.user_id;
    const tripTitle = bData.trip_title || (exp as any)?.title || 'Stay';
    const amountStr = `KES ${Number(bData.amount || 0).toLocaleString()}`;
    const bookingMode =
      (bData.terms_snapshot as any)?.booking_mode || (exp as any)?.booking_mode || 'approval_required';
    const isInstantConfirmed = bData.status === 'confirmed' || bookingMode === 'instant';
    const timezone = (bData.terms_snapshot as any)?.timezone || (exp as any)?.timezone || 'Africa/Nairobi';

    if (guestId) {
      await enqueueNotificationEvent(admin, {
        userId: guestId,
        type: isInstantConfirmed ? 'booking_confirmed' : 'payment_success',
        templateKey: 'payment_receipt',
        title: isInstantConfirmed ? 'Booking Confirmed & Paid!' : 'Payment Confirmed!',
        message: isInstantConfirmed
          ? `Your payment of ${amountStr} for "${tripTitle}" is complete and your reservation is confirmed.`
          : `Your payment of ${amountStr} for "${tripTitle}" was received. The host will confirm your reservation shortly.`,
        dedupeKey: `payment_success:${bookingId}:${guestId}`,
        priority: 'critical',
        channels: ['in_app', 'push', 'email', 'sms'],
        actionType: 'booking',
        actionId: bookingId,
        payload: {
          booking_id: bookingId,
          trip_title: tripTitle,
          amount: bData.amount,
          check_in: bData.check_in,
          check_out: bData.check_out,
          booking_mode: isInstantConfirmed ? 'instant' : 'approval_required',
          booking_status: bData.status,
          timezone,
        },
      });
    }

    if (hostId && hostId !== guestId) {
      await enqueueNotificationEvent(admin, {
        userId: hostId,
        type: 'booking_request',
        templateKey: 'booking_request',
        title: isInstantConfirmed ? 'New Confirmed Booking!' : 'Payment Received — Review Booking',
        message: isInstantConfirmed
          ? `A guest booked "${tripTitle}" (${amountStr}). View details in your Host Dashboard.`
          : `A guest paid ${amountStr} for "${tripTitle}". Review and confirm the reservation in your Host Dashboard.`,
        dedupeKey: `booking_request:${bookingId}:${hostId}`,
        priority: 'critical',
        channels: ['in_app', 'push', 'email', 'sms'],
        actionType: 'booking',
        actionId: bookingId,
        payload: {
          booking_id: bookingId,
          trip_title: tripTitle,
          amount: bData.amount,
          check_in: bData.check_in,
          check_out: bData.check_out,
          booking_mode: isInstantConfirmed ? 'instant' : 'approval_required',
          booking_status: bData.status,
          timezone,
        },
      });
    }

    kickNotificationQueueAsync();
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
        const failureMsg = String(data.gateway_response || data.message || 'Charge failed');
        await admin.rpc('settle_paystack_failure', {
          p_provider_reference: providerReference,
          p_failure_code: String(data.gateway_response || data.status || 'charge_failed'),
          p_failure_message: failureMsg,
          p_paystack_response: payload,
        });

        try {
          const { data: failedAttempt } = await admin
            .from('payment_attempts')
            .select('id, guest_id, quote_id, amount')
            .eq('provider_reference', providerReference)
            .maybeSingle();

          if (failedAttempt?.guest_id) {
            let tripTitle = 'your reservation';
            if (failedAttempt.quote_id) {
              const { data: qRow } = await admin
                .from('booking_quotes')
                .select('terms_snapshot')
                .eq('id', failedAttempt.quote_id)
                .maybeSingle();
              tripTitle = (qRow?.terms_snapshot as any)?.title || tripTitle;
            }

            await enqueueNotificationEvent(admin, {
              userId: failedAttempt.guest_id,
              type: 'payment_failed',
              templateKey: 'payment_failed',
              title: 'Payment Unsuccessful',
              message: `Your payment for "${tripTitle}" could not be completed (${failureMsg}). You can retry checkout anytime.`,
              dedupeKey: `payment_failed:${providerReference}:${failedAttempt.guest_id}`,
              priority: 'critical',
              channels: ['in_app', 'push', 'email', 'sms'],
              actionType: 'booking',
              actionId: failedAttempt.quote_id || failedAttempt.id,
              payload: {
                trip_title: tripTitle,
                amount_minor: failedAttempt.amount,
                failure_message: failureMsg,
                provider_reference: providerReference,
              },
            });
            kickNotificationQueueAsync();
          }
        } catch (failNotifErr) {
          console.warn('[paystack-webhook] charge.failed notification warning:', failNotifErr);
        }
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
            .select('id, user_id, trip_title, amount')
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

            // Deduplicated multi-channel refund notification (shares dedupeKey with process-booking-refund)
            if (bRow.user_id) {
              await enqueueNotificationEvent(admin, {
                userId: bRow.user_id,
                type: 'refund_processed',
                templateKey: 'refund_processed',
                title: 'Refund Completed!',
                message: `Your refund for "${bRow.trip_title || 'your reservation'}" has been processed successfully.`,
                dedupeKey: `refund_processed:${bRow.id}:${bRow.user_id}`,
                priority: 'critical',
                channels: ['in_app', 'push', 'email', 'sms'],
                actionType: 'booking',
                actionId: bRow.id,
                payload: {
                  booking_id: bRow.id,
                  trip_title: bRow.trip_title || 'your reservation',
                  amount: bRow.amount,
                },
              });
              kickNotificationQueueAsync();
            }
          }
        }
      }

      await admin
        .from('payment_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', eventRecordId);

      return json({ status: 'refund_settled' }, 200);
    } else if (
      eventType === 'transfer.success' ||
      eventType === 'transfer.failed' ||
      eventType === 'transfer.reversed'
    ) {
      const transferCode = data.transfer_code ? String(data.transfer_code) : null;
      const transferRef = data.reference ? String(data.reference) : null;

      let payoutRow: any = null;
      if (transferCode) {
        const { data: byCode } = await admin
          .from('host_payouts')
          .select('id, host_id, booking_id, amount, currency, status, provider_transfer_code')
          .eq('provider_transfer_code', transferCode)
          .maybeSingle();
        payoutRow = byCode;
      }

      if (!payoutRow && transferRef && transferRef.startsWith('payout_')) {
        const stripped = transferRef.slice('payout_'.length);
        if (stripped.length === 32) {
          const reconstructedUuid = `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(12, 16)}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
          const { data: byId } = await admin
            .from('host_payouts')
            .select('id, host_id, booking_id, amount, currency, status, provider_transfer_code')
            .eq('id', reconstructedUuid)
            .maybeSingle();
          payoutRow = byId;
        }
      }

      if (payoutRow) {
        const nowIso = new Date().toISOString();
        const resolvedTransferCode = transferCode || payoutRow.provider_transfer_code || transferRef || payoutRow.id;

        if (eventType === 'transfer.success') {
          if (payoutRow.status !== 'success') {
            await admin
              .from('host_payouts')
              .update({
                status: 'success',
                provider_transfer_code: resolvedTransferCode,
                provider_response: payload,
                processed_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', payoutRow.id);

            await admin.from('financial_ledger').insert({
              booking_id: payoutRow.booking_id,
              entry_type: 'host_payout_debit',
              debit_account: 'HOST_ESCROW_PAYABLE',
              credit_account: 'PAYSTACK_BANK_OUTFLOW',
              amount: payoutRow.amount,
              currency: payoutRow.currency || 'KES',
              metadata: {
                payout_id: payoutRow.id,
                transfer_code: resolvedTransferCode,
                host_id: payoutRow.host_id,
                settled_via: 'paystack_webhook',
              },
            });

            if (payoutRow.host_id) {
              const payoutAmountKES = (Number(payoutRow.amount) / 100).toLocaleString();
              const refId = payoutRow.booking_id
                ? String(payoutRow.booking_id).slice(0, 8).toUpperCase()
                : String(payoutRow.id).slice(0, 8).toUpperCase();
              await enqueueNotificationEvent(admin, {
                userId: payoutRow.host_id,
                type: 'payout_completed',
                templateKey: 'payout_completed',
                title: 'Payout Sent!',
                message: `KES ${payoutAmountKES} has been settled to your payout account for booking #${refId}.`,
                dedupeKey: `payout_completed:${payoutRow.id}:${payoutRow.host_id}`,
                priority: 'critical',
                channels: ['in_app', 'push', 'email', 'sms'],
                actionType: 'payout',
                actionId: payoutRow.id,
                payload: {
                  payout_id: payoutRow.id,
                  booking_id: payoutRow.booking_id,
                  amount_minor: payoutRow.amount,
                  transfer_code: resolvedTransferCode,
                },
              });
              kickNotificationQueueAsync();
            }
          }
        } else {
          // transfer.failed or transfer.reversed
          const failReason = String(
            data.reason || data.message || `Paystack ${eventType}`,
          );
          await admin
            .from('host_payouts')
            .update({
              status: 'failed',
              failure_reason: failReason,
              provider_response: payload,
              processed_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', payoutRow.id);

          if (payoutRow.host_id) {
            await enqueueNotificationEvent(admin, {
              userId: payoutRow.host_id,
              type: 'payout_failed',
              templateKey: 'payout_failed',
              title: 'Action Needed: Host Payout Failed',
              message: `Your host payout transfer could not be completed (${failReason}). Please verify your payout account details in Host Wallet.`,
              dedupeKey: `payout_failed:${payoutRow.id}:${payoutRow.host_id}`,
              priority: 'critical',
              channels: ['in_app', 'push', 'email', 'sms'],
              actionType: 'payout',
              actionId: payoutRow.id,
              payload: {
                payout_id: payoutRow.id,
                booking_id: payoutRow.booking_id,
                amount_minor: payoutRow.amount,
                failure_reason: failReason,
                transfer_code: resolvedTransferCode,
              },
            });
            kickNotificationQueueAsync();
          }
        }
      }

      await admin
        .from('payment_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', eventRecordId);

      return json({ status: `${eventType}_processed` }, 200);
    } else {
      // Unhandled event types (e.g. subscription events)
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
