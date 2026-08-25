-- Migration: Fix financial_ledger constraint and align settle_paystack_success entry types

-- 1. Safely expand financial_ledger check constraint to accept both canonical and alias entry types
ALTER TABLE public.financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_entry_type_check;
ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_entry_type_check
  CHECK (entry_type IN (
    'guest_payment',
    'host_escrow_credit',
    'escrow_hold',
    'platform_fee_revenue',
    'platform_fee_earned',
    'host_payout_debit',
    'refund_debit'
  ));

-- 2. Update settle_paystack_success to use canonical ledger entries and atomic execution
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

  -- Update Payment Attempt status
  UPDATE public.payment_attempts pa
  SET status = 'succeeded',
      provider_charge_id = COALESCE(p_provider_charge_id, pa.provider_charge_id),
      provider_response = COALESCE(p_paystack_response, pa.provider_response),
      succeeded_at = now()
  WHERE pa.id = v_attempt.id;

  -- Update Booking Quote status
  UPDATE public.booking_quotes bq
  SET status = 'consumed'
  WHERE bq.id = v_quote.id;

  -- Record Double-Entry Financial Ledger
  -- Entry 1: Guest Payment (Debit: PAYSTACK_CLEARING, Credit: PLATFORM_CASH)
  INSERT INTO public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) VALUES (
    v_booking_id, v_quote.id, v_attempt.id, 'guest_payment', 'PAYSTACK_CLEARING', 'PLATFORM_CASH', v_quote.total_amount, v_quote.currency,
    jsonb_build_object('guest_id', v_quote.guest_id)
  ) ON CONFLICT DO NOTHING;

  -- Entry 2: Host Escrow Credit (Debit: PLATFORM_CASH, Credit: HOST_ESCROW_PAYABLE)
  IF v_quote.host_payout_amount > 0 THEN
    INSERT INTO public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) VALUES (
      v_booking_id, v_quote.id, v_attempt.id, 'host_escrow_credit', 'PLATFORM_CASH', 'HOST_ESCROW_PAYABLE', v_quote.host_payout_amount, v_quote.currency,
      jsonb_build_object('host_id', v_quote.host_id, 'host_fee_amount', v_quote.host_service_fee_amount)
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Entry 3: Platform Service Fee Revenue (Debit: PLATFORM_CASH, Credit: PLATFORM_SERVICE_FEE_REVENUE)
  IF v_quote.host_service_fee_amount > 0 THEN
    INSERT INTO public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) VALUES (
      v_booking_id, v_quote.id, v_attempt.id, 'platform_fee_revenue', 'PLATFORM_CASH', 'PLATFORM_SERVICE_FEE_REVENUE', v_quote.host_service_fee_amount, v_quote.currency,
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
