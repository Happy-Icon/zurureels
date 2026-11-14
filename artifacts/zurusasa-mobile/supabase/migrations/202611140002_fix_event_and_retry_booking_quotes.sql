-- =============================================================================
-- Migration: 202611140002_fix_event_and_retry_booking_quotes.sql
-- Fixes:
--   1. Prevents self-deadlock ("23P01: booking_quotes_active_dates_excl") when a
--      guest retries reservation/payment after a failed payment attempt by reusing
--      matching active quotes or cancelling stale unconsumed quotes for that guest.
--   2. Distinguishes exclusive single-unit accommodation stays (is_exclusive_stay = true)
--      from multi-guest events / tours / dining experiences (is_exclusive_stay = false)
--      so events validate remaining ticket capacity instead of locking out all buyers
--      after one quote or booking.
--   3. Allows zero-amount (Free Entry) event reservations to settle cleanly in
--      settle_paystack_success without violating financial_ledger CHECK (amount > 0).
-- =============================================================================

-- 1. ADD is_exclusive_stay FLAG TO booking_quotes & bookings
ALTER TABLE public.booking_quotes
  ADD COLUMN IF NOT EXISTS is_exclusive_stay boolean NOT NULL DEFAULT true;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_exclusive_stay boolean NOT NULL DEFAULT true;

UPDATE public.booking_quotes bq
SET is_exclusive_stay = (
  lower(coalesce(e.category, '')) IN ('accommodation', 'hotel', 'villa', 'apartment', 'stay', 'stays')
  AND lower(coalesce(e.price_unit, 'night')) IN ('night', 'nights', 'per_night')
)
FROM public.experiences e
WHERE e.id = bq.experience_id;

UPDATE public.bookings b
SET is_exclusive_stay = (
  lower(coalesce(e.category, '')) IN ('accommodation', 'hotel', 'villa', 'apartment', 'stay', 'stays')
  AND lower(coalesce(e.price_unit, 'night')) IN ('night', 'nights', 'per_night')
)
FROM public.experiences e
WHERE e.id = b.experience_id;

-- 2. EXCLUSION CONSTRAINTS (Scope GiST active-date exclusion to exclusive stays only)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlapping_confirmed_stays;

ALTER TABLE public.booking_quotes
  DROP CONSTRAINT IF EXISTS booking_quotes_active_dates_excl;

ALTER TABLE public.booking_quotes
  ADD CONSTRAINT booking_quotes_active_dates_excl
  EXCLUDE USING gist (
    experience_id WITH =,
    tstzrange(check_in, check_out, '[)') WITH &&
  ) WHERE (
    is_exclusive_stay = true
    AND status IN ('quote_locked', 'payment_pending', 'payment_succeeded', 'confirmed')
  );

-- 3. UPDATE get_experience_unavailable_dates(uuid)
-- Only exclusive stays mark dates unavailable across users via bookings/quote holds,
-- and never hide dates because of the caller's own unconsumed checkout quote.
CREATE OR REPLACE FUNCTION public.get_experience_unavailable_dates(
  p_experience_id uuid
)
RETURNS TABLE (
  start_date date,
  end_date date,
  reason text,
  block_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- A. Manual host blocked dates
  SELECT
    h.start_date,
    h.end_date,
    h.reason,
    'host_blocked' AS block_type
  FROM public.host_blocked_dates h
  WHERE h.experience_id = p_experience_id

  UNION ALL

  -- B. Active exclusive-stay bookings
  SELECT
    b.check_in::date AS start_date,
    b.check_out::date AS end_date,
    'Reserved' AS reason,
    'booking' AS block_type
  FROM public.bookings b
  WHERE b.experience_id = p_experience_id
    AND b.is_exclusive_stay = true
    AND coalesce(b.status, 'pending') NOT IN ('cancelled', 'declined', 'refunded', 'failed')

  UNION ALL

  -- C. In-flight active quotes held by other guests for exclusive stays
  SELECT
    q.check_in::date AS start_date,
    q.check_out::date AS end_date,
    'Checkout in progress' AS reason,
    'quote_hold' AS block_type
  FROM public.booking_quotes q
  WHERE q.experience_id = p_experience_id
    AND q.is_exclusive_stay = true
    AND q.status IN ('quote_locked', 'payment_pending', 'payment_succeeded')
    AND q.expires_at > now()
    AND q.guest_id IS DISTINCT FROM auth.uid()

  UNION ALL

  -- D. External calendar busy blocks (Google Calendar / iCal sync)
  SELECT
    eb.start_date,
    eb.end_date,
    'External block' AS reason,
    'external_calendar' AS block_type
  FROM public.external_calendar_blocks eb
  WHERE eb.experience_id = p_experience_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_experience_unavailable_dates(uuid) TO anon, authenticated, service_role;

-- 4. UPDATE create_booking_quote (Idempotent retry reuse + Event capacity check)
CREATE OR REPLACE FUNCTION public.create_booking_quote(
  p_experience_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_guest_count integer,
  p_idempotency_key uuid
)
RETURNS public.booking_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id uuid := auth.uid();
  v_experience record;
  v_host_profile record;
  v_quote public.booking_quotes%ROWTYPE;
  v_is_exclusive_stay boolean := true;
  v_booked_guests integer := 0;
  v_units integer;
  v_subtotal bigint;
  v_host_fee_bps integer := 1500;
  v_host_fee bigint;
  v_setting jsonb;
  v_free_cancellation_until timestamptz;
  v_policy_type text;
  v_cancellation_snapshot jsonb;
  v_terms_snapshot jsonb;
  v_house_rules_snapshot jsonb;
  v_arrival_snapshot jsonb;
  v_checkout_snapshot jsonb;
BEGIN
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'An idempotency key is required' USING errcode = '22023';
  END IF;
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in
     OR p_check_in < (now() - interval '1 day')
     OR p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > 30 THEN
    RAISE EXCEPTION 'Invalid booking dates or guest count' USING errcode = '22023';
  END IF;

  PERFORM public.expire_booking_quotes();

  SELECT * INTO v_quote FROM public.booking_quotes
  WHERE guest_id = v_guest_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_quote; END IF;

  -- Lock experience record
  SELECT e.id, e.user_id, e.title, e.category, e.location, e.current_price, e.price_unit,
         e.availability_status, e.max_guests, e.min_stay_nights, e.max_stay_nights,
         e.check_in_time, e.check_out_time, e.booking_mode, e.cancellation_policy,
         e.house_rules, e.arrival_instructions, e.checkout_instructions, e.image_url
  INTO v_experience FROM public.experiences e
  WHERE e.id = p_experience_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found' USING errcode = 'P0002'; END IF;
  IF v_experience.user_id = v_guest_id THEN
    RAISE EXCEPTION 'Hosts cannot book their own listing' USING errcode = '22023';
  END IF;
  IF COALESCE(v_experience.availability_status, 'available') <> 'available' THEN
    RAISE EXCEPTION 'Listing is not available' USING errcode = 'P0001';
  END IF;

  v_is_exclusive_stay :=
    lower(coalesce(v_experience.category, '')) IN ('accommodation', 'hotel', 'villa', 'apartment', 'stay', 'stays')
    AND lower(coalesce(v_experience.price_unit, 'night')) IN ('night', 'nights', 'per_night');

  -- Check max guests per booking
  IF v_experience.max_guests IS NOT NULL AND p_guest_count > v_experience.max_guests THEN
    RAISE EXCEPTION 'Guest count exceeds maximum occupancy of % guests', v_experience.max_guests USING errcode = '22023';
  END IF;

  -- Verify against host blocked dates
  IF EXISTS (
    SELECT 1 FROM public.host_blocked_dates h
    WHERE h.experience_id = p_experience_id
      AND h.start_date < p_check_out::date
      AND h.end_date > p_check_in::date
  ) THEN
    RAISE EXCEPTION 'Those dates are blocked by the host' USING errcode = 'P0001';
  END IF;

  -- Verify availability against active bookings (exclusive stays vs multi-capacity events/experiences)
  IF v_is_exclusive_stay THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.experience_id = p_experience_id
        AND COALESCE(b.status, 'pending') NOT IN ('cancelled', 'declined', 'refunded', 'failed')
        AND b.check_in < p_check_out AND b.check_out > p_check_in
    ) THEN
      RAISE EXCEPTION 'Those dates are no longer available' USING errcode = 'P0001';
    END IF;
  ELSE
    SELECT COALESCE(SUM(b.guests), 0)::integer
    INTO v_booked_guests
    FROM public.bookings b
    WHERE b.experience_id = p_experience_id
      AND COALESCE(b.status, 'pending') NOT IN ('cancelled', 'declined', 'refunded', 'failed')
      AND b.check_in < p_check_out AND b.check_out > p_check_in;

    IF v_experience.max_guests IS NOT NULL AND (v_booked_guests + p_guest_count) > v_experience.max_guests THEN
      RAISE EXCEPTION 'Event capacity reached (% spots remaining)', greatest(0, v_experience.max_guests - v_booked_guests) USING errcode = 'P0001';
    END IF;
  END IF;

  -- Verify against external calendar blocks
  IF EXISTS (
    SELECT 1 FROM public.external_calendar_blocks eb
    WHERE eb.experience_id = p_experience_id
      AND eb.start_date < p_check_out::date
      AND eb.end_date > p_check_in::date
  ) THEN
    RAISE EXCEPTION 'Those dates are blocked by external calendar sync' USING errcode = 'P0001';
  END IF;

  -- Reuse an existing active unconsumed quote for this guest if dates & guest count match
  SELECT bq.* INTO v_quote
  FROM public.booking_quotes bq
  WHERE bq.guest_id = v_guest_id
    AND bq.experience_id = p_experience_id
    AND bq.expires_at > now()
    AND (
      bq.status = 'quote_locked'
      OR (
        bq.status = 'payment_pending'
        AND NOT EXISTS (
          SELECT 1 FROM public.payment_attempts pa
          WHERE pa.quote_id = bq.id AND pa.status IN ('created', 'pending')
        )
      )
    )
    AND bq.check_in = p_check_in
    AND bq.check_out = p_check_out
    AND bq.guest_count = p_guest_count
  ORDER BY bq.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.booking_quotes bq
    SET status = 'quote_locked',
        is_exclusive_stay = v_is_exclusive_stay,
        expires_at = now() + interval '15 minutes',
        updated_at = now()
    WHERE bq.id = v_quote.id
    RETURNING * INTO v_quote;

    RETURN v_quote;
  END IF;

  -- Supersede any other prior unconsumed locks from this guest for the same experience
  UPDATE public.booking_quotes bq
  SET status = 'cancelled',
      updated_at = now()
  WHERE bq.guest_id = v_guest_id
    AND bq.experience_id = p_experience_id
    AND (
      bq.status = 'quote_locked'
      OR (
        bq.status = 'payment_pending'
        AND NOT EXISTS (
          SELECT 1 FROM public.payment_attempts pa
          WHERE pa.quote_id = bq.id AND pa.status IN ('created', 'pending')
        )
      )
    );

  IF v_experience.current_price IS NULL OR v_experience.current_price < 0 THEN
    RAISE EXCEPTION 'Listing price is unavailable' USING errcode = 'P0001';
  END IF;

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'commission';
  IF v_setting ? 'host_fee_bps' THEN v_host_fee_bps := (v_setting->>'host_fee_bps')::integer; END IF;
  IF v_host_fee_bps < 0 OR v_host_fee_bps > 10000 THEN
    RAISE EXCEPTION 'Invalid platform commission configuration' USING errcode = 'P0001';
  END IF;

  v_units := CASE WHEN lower(COALESCE(v_experience.price_unit, 'night')) IN ('night', 'nights', 'per_night')
    THEN greatest(1, ceil(extract(epoch from (p_check_out - p_check_in)) / 86400.0)::integer)
    ELSE p_guest_count END;

  -- Check min stay nights for night-based listings
  IF lower(COALESCE(v_experience.price_unit, 'night')) IN ('night', 'nights', 'per_night') AND v_experience.min_stay_nights IS NOT NULL AND v_units < v_experience.min_stay_nights THEN
    RAISE EXCEPTION 'Minimum stay is % nights', v_experience.min_stay_nights USING errcode = '22023';
  END IF;

  v_subtotal := round(v_experience.current_price * v_units * 100)::bigint;
  v_host_fee := round(v_subtotal * (v_host_fee_bps / 10000.0))::bigint;

  -- Cancellation Policy Snapshot Calculation
  v_policy_type := COALESCE(v_experience.cancellation_policy, 'flexible');
  IF v_policy_type = 'strict' THEN
    v_free_cancellation_until := least(p_check_in - interval '7 days', now() + interval '48 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'strict',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 5000,
      'policy_note', 'Full refund if cancelled at least 7 days before check-in. 50% refund thereafter up to 48h before check-in.'
    );
  ELSIF v_policy_type = 'moderate' THEN
    v_free_cancellation_until := least(p_check_in - interval '5 days', now() + interval '48 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'moderate',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 5000,
      'policy_note', 'Full refund up to 5 days before check-in. Partial refund thereafter.'
    );
  ELSE
    v_free_cancellation_until := least(p_check_in - interval '24 hours', now() + interval '24 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'flexible',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 0,
      'policy_note', 'Full refund up to 24 hours before check-in. Non-refundable after check-in.'
    );
  END IF;

  -- Fetch Host profile for terms snapshot
  SELECT full_name INTO v_host_profile FROM public.profiles WHERE id = v_experience.user_id;

  v_terms_snapshot := jsonb_build_object(
    'title', v_experience.title,
    'category', v_experience.category,
    'location', v_experience.location,
    'host_name', COALESCE(v_host_profile.full_name, 'Host'),
    'check_in_time', COALESCE(v_experience.check_in_time, '14:00'),
    'check_out_time', COALESCE(v_experience.check_out_time, '10:00'),
    'booking_mode', COALESCE(v_experience.booking_mode, 'approval_required'),
    'image_url', v_experience.image_url
  );

  v_house_rules_snapshot := COALESCE(v_experience.house_rules, '{"smoking_allowed": false, "pets_allowed": false, "parties_allowed": false, "children_allowed": true, "additional_guests_allowed": false, "quiet_hours_start": "22:00", "quiet_hours_end": "07:00", "custom_rules": ""}'::jsonb);
  v_arrival_snapshot := COALESCE(v_experience.arrival_instructions, '{"check_in_method": "Self check-in", "directions": "", "parking_info": "", "wifi_ssid": "", "wifi_password": "", "access_instructions": ""}'::jsonb);
  v_checkout_snapshot := COALESCE(v_experience.checkout_instructions, '{"key_return_instructions": "", "trash_instructions": "", "cleaning_expectations": "", "custom_notes": ""}'::jsonb);

  INSERT INTO public.booking_quotes (
    guest_id, host_id, experience_id, idempotency_key, check_in, check_out, guest_count,
    is_exclusive_stay,
    pricing_snapshot, cancellation_policy_snapshot, terms_snapshot, house_rules_snapshot,
    arrival_snapshot, checkout_snapshot, subtotal_amount, guest_service_fee_amount,
    tax_amount, total_amount, host_service_fee_amount, host_payout_amount,
    terms_acknowledged_at
  ) VALUES (
    v_guest_id, v_experience.user_id, p_experience_id, p_idempotency_key, p_check_in, p_check_out, p_guest_count,
    v_is_exclusive_stay,
    jsonb_build_object('listing_unit_price', v_experience.current_price, 'listing_price_unit', COALESCE(v_experience.price_unit, 'night'), 'units', v_units, 'currency', 'KES', 'price_scale', 100, 'host_fee_bps', v_host_fee_bps),
    v_cancellation_snapshot,
    v_terms_snapshot,
    v_house_rules_snapshot,
    v_arrival_snapshot,
    v_checkout_snapshot,
    v_subtotal, 0, 0, v_subtotal, v_host_fee, v_subtotal - v_host_fee,
    now()
  ) RETURNING * INTO v_quote;

  RETURN v_quote;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_quote(uuid, timestamptz, timestamptz, integer, uuid) TO authenticated;

-- 5. UPDATE settle_paystack_success (Preserve service_role lock + carry is_exclusive_stay + support zero-amount free entry)
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
  v_jwt_role text := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_attempt public.payment_attempts%ROWTYPE;
  v_quote public.booking_quotes%ROWTYPE;
  v_experience record;
  v_booking_id uuid;
  v_trip_title text;
  v_target_status text := 'paid';
BEGIN
  -- Defense-in-depth: strictly enforce service_role (or direct postgres/supabase_admin session)
  IF v_jwt_role <> 'service_role' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Forbidden: settle_paystack_success requires service_role' USING errcode = '42501';
  END IF;

  SELECT pa.* INTO v_attempt
  FROM public.payment_attempts pa
  WHERE pa.provider_reference = p_provider_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment attempt with reference % not found', p_provider_reference USING errcode = 'P0002';
  END IF;

  -- Idempotent replay if already succeeded
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

  IF COALESCE(v_experience.booking_mode, 'approval_required') = 'instant' THEN
    v_target_status := 'confirmed';
  ELSE
    v_target_status := 'paid';
  END IF;

  INSERT INTO public.bookings (
    user_id,
    experience_id,
    trip_title,
    amount,
    guests,
    check_in,
    check_out,
    status,
    is_exclusive_stay,
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
    COALESCE(v_quote.is_exclusive_stay, true),
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

  -- Double-Entry Financial Ledger (only recorded for positive payment amounts)
  IF v_quote.total_amount > 0 THEN
    INSERT INTO public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) VALUES (
      v_booking_id, v_quote.id, v_attempt.id, 'guest_payment', 'PAYSTACK_CLEARING', 'PLATFORM_CASH', v_quote.total_amount, v_quote.currency,
      jsonb_build_object('guest_id', v_quote.guest_id)
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF v_quote.host_payout_amount > 0 THEN
    INSERT INTO public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) VALUES (
      v_booking_id, v_quote.id, v_attempt.id, 'host_escrow_credit', 'PLATFORM_CASH', 'HOST_ESCROW_PAYABLE', v_quote.host_payout_amount, v_quote.currency,
      jsonb_build_object('host_id', v_quote.host_id, 'host_fee_amount', v_quote.host_service_fee_amount)
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF v_quote.host_service_fee_amount > 0 THEN
    INSERT INTO public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) VALUES (
      v_booking_id, v_quote.id, v_attempt.id, 'platform_fee_revenue', 'PLATFORM_CASH', 'PLATFORM_SERVICE_FEE_REVENUE', v_quote.host_service_fee_amount, v_quote.currency,
      jsonb_build_object('host_id', v_quote.host_id)
    ) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.booking_lifecycle_events (
    booking_id, from_status, to_status, actor_type, reason
  ) VALUES (
    v_booking_id, 'quote_locked', v_target_status, 'payment_provider', 'Payment verified and settled'
  );

  -- Schedule host payout safely (will only schedule if instant-confirmed and positive amount)
  BEGIN
    PERFORM set_config('app.internal_rpc_trusted', 'true', true);
    PERFORM public.schedule_pending_host_payouts(v_quote.host_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_paystack_success(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paystack_success(text, text, jsonb) TO service_role;
