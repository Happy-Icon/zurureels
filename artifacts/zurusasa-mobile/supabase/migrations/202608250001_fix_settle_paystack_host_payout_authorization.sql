-- Migration: Fix schedule_pending_host_payouts auth check during booking settlement

-- 1. Fix schedule_pending_host_payouts to allow invocation during booking settlement
CREATE OR REPLACE FUNCTION public.schedule_pending_host_payouts(p_host_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient record;
  v_booking record;
  v_count integer := 0;
BEGIN
  IF p_host_id IS NULL THEN
    RAISE EXCEPTION 'Host ID is required' USING errcode = '22023';
  END IF;

  -- Lookup active payout recipient for host
  SELECT recipient_code INTO v_recipient
  FROM public.host_payout_recipients
  WHERE host_id = p_host_id AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recipient.recipient_code IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_booking IN
    SELECT b.id AS booking_id, b.check_out, q.host_id, q.host_payout_amount, q.currency
    FROM public.bookings b
    JOIN public.booking_quotes q ON q.id = b.quote_id
    WHERE q.host_id = p_host_id
      AND b.status IN ('confirmed', 'completed', 'paid')
      AND q.host_payout_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.host_payouts hp
        WHERE hp.booking_id = b.id AND hp.status IN ('scheduled', 'processing', 'success')
      )
  LOOP
    INSERT INTO public.host_payouts (
      host_id,
      booking_id,
      recipient_code,
      amount,
      currency,
      scheduled_for,
      status
    ) VALUES (
      v_booking.host_id,
      v_booking.booking_id,
      v_recipient.recipient_code,
      v_booking.host_payout_amount,
      COALESCE(v_booking.currency, 'KES'),
      greatest(now(), v_booking.check_out + interval '24 hours'),
      'scheduled'
    )
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 2. Ensure settle_paystack_success handles idempotent retries and has robust grants
CREATE OR REPLACE FUNCTION public.settle_paystack_success(
  p_provider_reference text,
  p_provider_charge_id text,
  p_paystack_response jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.payment_attempts%ROWTYPE;
  v_quote public.booking_quotes%ROWTYPE;
  v_experience record;
  v_booking_id uuid;
  v_trip_title text;
  v_target_status text := 'paid';
BEGIN
  SELECT pa.* INTO v_attempt
  FROM public.payment_attempts pa
  WHERE pa.provider_reference = p_provider_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment attempt with reference % not found', p_provider_reference USING errcode = 'P0002';
  END IF;

  -- If already succeeded, return existing booking
  IF v_attempt.status = 'succeeded' THEN
    SELECT b.id INTO v_booking_id
    FROM public.bookings b
    WHERE b.payment_attempt_id = v_attempt.id OR b.quote_id = v_attempt.quote_id;
    IF v_booking_id IS NOT NULL THEN
      RETURN v_booking_id;
    END IF;
  END IF;

  SELECT bq.* INTO v_quote
  FROM public.booking_quotes bq
  WHERE bq.id = v_attempt.quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated quote not found' USING errcode = 'P0002';
  END IF;

  IF v_quote.status IN ('consumed', 'payment_succeeded') THEN
    SELECT b.id INTO v_booking_id
    FROM public.bookings b
    WHERE b.quote_id = v_quote.id OR b.payment_attempt_id = v_attempt.id;
    IF v_booking_id IS NOT NULL THEN
      RETURN v_booking_id;
    END IF;
  END IF;

  SELECT e.title, e.booking_mode INTO v_experience
  FROM public.experiences e
  WHERE e.id = v_quote.experience_id;

  v_trip_title := COALESCE((v_quote.terms_snapshot->>'title'), v_experience.title, 'Stay Booking');

  -- Instant booking mode can confirm immediately upon payment
  IF COALESCE(v_experience.booking_mode, 'approval_required') = 'instant' THEN
    v_target_status := 'confirmed';
  ELSE
    v_target_status := 'paid';
  END IF;

  -- Insert Booking with Immutable Snapshots
  INSERT INTO public.bookings (
    user_id,
    experience_id,
    trip_title,
    amount,
    guests,
    check_in,
    check_out,
    status,
    quote_id,
    payment_attempt_id,
    terms_snapshot,
    house_rules_snapshot,
    cancellation_policy_snapshot,
    arrival_snapshot,
    checkout_snapshot,
    terms_acknowledged_at
  ) VALUES (
    v_quote.guest_id,
    v_quote.experience_id,
    v_trip_title,
    round(v_quote.total_amount / 100.0, 2),
    v_quote.guest_count,
    v_quote.check_in,
    v_quote.check_out,
    v_target_status,
    v_quote.id,
    v_attempt.id,
    v_quote.terms_snapshot,
    v_quote.house_rules_snapshot,
    v_quote.cancellation_policy_snapshot,
    v_quote.arrival_snapshot,
    v_quote.checkout_snapshot,
    COALESCE(v_quote.terms_acknowledged_at, now())
  ) RETURNING id INTO v_booking_id;

  UPDATE public.payment_attempts pa
  SET status = 'succeeded',
      provider_charge_id = COALESCE(p_provider_charge_id, pa.provider_charge_id),
      provider_response = COALESCE(p_paystack_response, pa.provider_response),
      succeeded_at = now()
  WHERE pa.id = v_attempt.id;

  UPDATE public.booking_quotes bq
  SET status = 'consumed'
  WHERE bq.id = v_quote.id;

  -- Record Double-Entry Financial Ledger
  INSERT INTO public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) VALUES (
    v_booking_id, v_quote.id, v_attempt.id, 'guest_payment', 'PAYSTACK_CLEARING', 'PLATFORM_CASH', v_quote.total_amount, v_quote.currency,
    jsonb_build_object('guest_id', v_quote.guest_id)
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) VALUES (
    v_booking_id, v_quote.id, v_attempt.id, 'escrow_hold', 'PLATFORM_CASH', 'HOST_ESCROW_PAYABLE', v_quote.host_payout_amount, v_quote.currency,
    jsonb_build_object('host_id', v_quote.host_id, 'host_fee_amount', v_quote.host_service_fee_amount)
  ) ON CONFLICT DO NOTHING;

  IF v_quote.host_service_fee_amount > 0 THEN
    INSERT INTO public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) VALUES (
      v_booking_id, v_quote.id, v_attempt.id, 'platform_fee_earned', 'PLATFORM_CASH', 'PLATFORM_REVENUE', v_quote.host_service_fee_amount, v_quote.currency,
      jsonb_build_object('host_id', v_quote.host_id)
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Lifecycle audit log
  INSERT INTO public.booking_lifecycle_events (
    booking_id, from_status, to_status, actor_type, reason
  ) VALUES (
    v_booking_id, 'quote_locked', v_target_status, 'payment_provider', 'Payment verified and settled'
  );

  -- Schedule host payout safely
  BEGIN
    PERFORM public.schedule_pending_host_payouts(v_quote.host_id);
  EXCEPTION WHEN OTHERS THEN
    -- Payout scheduling failure should never abort the confirmed guest booking
    NULL;
  END;

  RETURN v_booking_id;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.schedule_pending_host_payouts(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.settle_paystack_success(text, text, jsonb) TO authenticated, service_role, anon;
