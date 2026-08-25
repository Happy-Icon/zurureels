-- =============================================================================
-- Migration: 202608200006_marketplace_booking_deepening_and_reviews.sql
-- Description: Production Marketplace Booking Experience, Immutable Term Snapshots,
--              Structured Rules/Policies, Arrival/Checkout Info, and Secure Reviews System.
-- =============================================================================

-- 1. EXTEND EXPERIENCES TABLE WITH STRUCTURED BOOKING CONFIGURATION
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS max_guests integer DEFAULT 2 CHECK (max_guests > 0),
  ADD COLUMN IF NOT EXISTS min_stay_nights integer DEFAULT 1 CHECK (min_stay_nights > 0),
  ADD COLUMN IF NOT EXISTS max_stay_nights integer DEFAULT 30 CHECK (max_stay_nights >= min_stay_nights),
  ADD COLUMN IF NOT EXISTS check_in_time text DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS check_out_time text DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS booking_mode text DEFAULT 'approval_required' CHECK (booking_mode IN ('instant', 'approval_required')),
  ADD COLUMN IF NOT EXISTS cancellation_policy text DEFAULT 'flexible' CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict')),
  ADD COLUMN IF NOT EXISTS house_rules jsonb DEFAULT '{"smoking_allowed": false, "pets_allowed": false, "parties_allowed": false, "children_allowed": true, "additional_guests_allowed": false, "quiet_hours_start": "22:00", "quiet_hours_end": "07:00", "custom_rules": ""}'::jsonb,
  ADD COLUMN IF NOT EXISTS arrival_instructions jsonb DEFAULT '{"check_in_method": "Self check-in", "directions": "", "parking_info": "", "wifi_ssid": "", "wifi_password": "", "access_instructions": ""}'::jsonb,
  ADD COLUMN IF NOT EXISTS checkout_instructions jsonb DEFAULT '{"key_return_instructions": "", "trash_instructions": "", "cleaning_expectations": "", "custom_notes": ""}'::jsonb,
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}'::text[];

-- 2. EXTEND BOOKING QUOTES & BOOKINGS WITH IMMUTABLE TERM SNAPSHOTS
ALTER TABLE public.booking_quotes
  ADD COLUMN IF NOT EXISTS terms_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS house_rules_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS arrival_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS checkout_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS terms_acknowledged_at timestamptz;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS terms_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS house_rules_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS arrival_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS checkout_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS terms_acknowledged_at timestamptz;

-- 3. PRODUCTION REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  listing_id uuid REFERENCES public.experiences(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating numeric(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
  cleanliness numeric(2,1) CHECK (cleanliness >= 1.0 AND cleanliness <= 5.0),
  accuracy numeric(2,1) CHECK (accuracy >= 1.0 AND accuracy <= 5.0),
  communication numeric(2,1) CHECK (communication >= 1.0 AND communication <= 5.0),
  location numeric(2,1) CHECK (location >= 1.0 AND location <= 5.0),
  value numeric(2,1) CHECK (value >= 1.0 AND value <= 5.0),
  check_in numeric(2,1) CHECK (check_in >= 1.0 AND check_in <= 5.0),
  comment text NOT NULL CHECK (length(trim(comment)) > 0),
  photos text[] DEFAULT '{}'::text[],
  is_host_review boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one review per booking per direction
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_direction_idx
  ON public.reviews (booking_id, is_host_review);

CREATE INDEX IF NOT EXISTS reviews_listing_created_idx
  ON public.reviews (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_reviewer_idx
  ON public.reviews (reviewer_id);

CREATE INDEX IF NOT EXISTS reviews_reviewee_idx
  ON public.reviews (reviewee_id);

-- RLS on reviews: Publicly readable; server-controlled write
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are readable by everyone" ON public.reviews;
CREATE POLICY "Reviews are readable by everyone"
  ON public.reviews FOR SELECT
  USING (true);

-- Revoke direct mutation permissions on reviews from clients
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM anon, authenticated;

-- 4. AUTHORITATIVE REVIEW SUBMISSION RPC
CREATE OR REPLACE FUNCTION public.submit_booking_review(
  p_booking_id uuid,
  p_rating numeric,
  p_cleanliness numeric DEFAULT NULL,
  p_accuracy numeric DEFAULT NULL,
  p_communication numeric DEFAULT NULL,
  p_location numeric DEFAULT NULL,
  p_value numeric DEFAULT NULL,
  p_check_in numeric DEFAULT NULL,
  p_comment text DEFAULT '',
  p_photos text[] DEFAULT '{}'::text[]
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_booking record;
  v_host_id uuid;
  v_review public.reviews%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to submit a review' USING errcode = '28000';
  END IF;

  IF p_rating IS NULL OR p_rating < 1.0 OR p_rating > 5.0 THEN
    RAISE EXCEPTION 'Rating must be between 1.0 and 5.0' USING errcode = '22023';
  END IF;

  IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
    RAISE EXCEPTION 'Review comment cannot be empty' USING errcode = '22023';
  END IF;

  -- Verify booking eligibility
  SELECT b.id, b.user_id, b.experience_id, b.status, b.check_out, b.trip_title, e.user_id AS host_id
  INTO v_booking
  FROM public.bookings b
  LEFT JOIN public.experiences e ON e.id = b.experience_id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  IF v_booking.user_id <> v_user_id THEN
    RAISE EXCEPTION 'You can only review bookings made by your account' USING errcode = '42501';
  END IF;

  -- Eligibility: status must be completed, or confirmed with checkout passed
  IF v_booking.status <> 'completed' AND NOT (v_booking.status = 'confirmed' AND v_booking.check_out <= now()) THEN
    RAISE EXCEPTION 'Reviews can only be submitted after your stay is completed' USING errcode = 'P0001';
  END IF;

  -- Check if review already exists
  IF EXISTS (
    SELECT 1 FROM public.reviews
    WHERE booking_id = p_booking_id AND is_host_review = false
  ) THEN
    RAISE EXCEPTION 'A review for this reservation has already been submitted' USING errcode = '23505';
  END IF;

  v_host_id := v_booking.host_id;

  -- Insert review
  INSERT INTO public.reviews (
    booking_id,
    listing_id,
    reviewer_id,
    reviewee_id,
    rating,
    cleanliness,
    accuracy,
    communication,
    location,
    value,
    check_in,
    comment,
    photos,
    is_host_review,
    helpful_count
  ) VALUES (
    p_booking_id,
    v_booking.experience_id,
    v_user_id,
    v_host_id,
    round(p_rating, 1),
    CASE WHEN p_cleanliness IS NOT NULL THEN round(p_cleanliness, 1) ELSE NULL END,
    CASE WHEN p_accuracy IS NOT NULL THEN round(p_accuracy, 1) ELSE NULL END,
    CASE WHEN p_communication IS NOT NULL THEN round(p_communication, 1) ELSE NULL END,
    CASE WHEN p_location IS NOT NULL THEN round(p_location, 1) ELSE NULL END,
    CASE WHEN p_value IS NOT NULL THEN round(p_value, 1) ELSE NULL END,
    CASE WHEN p_check_in IS NOT NULL THEN round(p_check_in, 1) ELSE NULL END,
    trim(p_comment),
    COALESCE(p_photos, '{}'::text[]),
    false,
    0
  ) RETURNING * INTO v_review;

  -- Notify Host of the new review
  IF v_host_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      action_type,
      action_id,
      metadata
    ) VALUES (
      v_host_id,
      'new_review',
      'New Guest Review ⭐',
      COALESCE('A guest left a ' || p_rating || '-star review for "' || v_booking.trip_title || '".', 'You received a new guest review.'),
      'review',
      v_review.id,
      jsonb_build_object('review_id', v_review.id, 'booking_id', p_booking_id, 'rating', p_rating)
    );
  END IF;

  RETURN v_review;
END;
$$;

-- 5. REAL REVIEWS SUMMARY & CATEGORY AGGREGATION RPC
CREATE OR REPLACE FUNCTION public.get_listing_reviews_summary(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb;
BEGIN
  SELECT jsonb_build_object(
    'averageRating', COALESCE(round(AVG(rating)::numeric, 2), 5.0),
    'totalCount', COUNT(*),
    'ratingBreakdown', jsonb_build_object(
      '5', COUNT(*) FILTER (WHERE rating >= 4.5),
      '4', COUNT(*) FILTER (WHERE rating >= 3.5 AND rating < 4.5),
      '3', COUNT(*) FILTER (WHERE rating >= 2.5 AND rating < 3.5),
      '2', COUNT(*) FILTER (WHERE rating >= 1.5 AND rating < 2.5),
      '1', COUNT(*) FILTER (WHERE rating < 1.5)
    ),
    'categoryAverages', jsonb_build_object(
      'cleanliness', COALESCE(round(AVG(cleanliness)::numeric, 1), 5.0),
      'communication', COALESCE(round(AVG(communication)::numeric, 1), 5.0),
      'accuracy', COALESCE(round(AVG(accuracy)::numeric, 1), 5.0),
      'location', COALESCE(round(AVG(location)::numeric, 1), 5.0),
      'value', COALESCE(round(AVG(value)::numeric, 1), 5.0),
      'checkIn', COALESCE(round(AVG(check_in)::numeric, 1), 5.0)
    )
  ) INTO v_summary
  FROM public.reviews
  WHERE listing_id = p_listing_id AND is_host_review = false;

  RETURN v_summary;
END;
$$;

-- 6. UPDATED CREATE_BOOKING_QUOTE (Capturing Structured Term Snapshots)
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

  -- Check max guests
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

  -- Verify against active bookings
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.experience_id = p_experience_id
      AND COALESCE(b.status, 'pending') NOT IN ('cancelled', 'refunded', 'failed')
      AND b.check_in < p_check_out AND b.check_out > p_check_in
  ) THEN
    RAISE EXCEPTION 'Those dates are no longer available' USING errcode = 'P0001';
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
    pricing_snapshot, cancellation_policy_snapshot, terms_snapshot, house_rules_snapshot,
    arrival_snapshot, checkout_snapshot, subtotal_amount, guest_service_fee_amount,
    tax_amount, total_amount, host_service_fee_amount, host_payout_amount,
    terms_acknowledged_at
  ) VALUES (
    v_guest_id, v_experience.user_id, p_experience_id, p_idempotency_key, p_check_in, p_check_out, p_guest_count,
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

-- 7. UPDATED SETTLE_PAYSTACK_SUCCESS (Freezing Term Snapshots into Bookings)
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

  IF v_attempt.status = 'succeeded' THEN
    SELECT b.id INTO v_booking_id
    FROM public.bookings b
    WHERE b.payment_attempt_id = v_attempt.id;
    IF v_booking_id IS NOT NULL THEN
      RETURN v_booking_id;
    END IF;
  END IF;

  IF v_attempt.status NOT IN ('created', 'pending') THEN
    RAISE EXCEPTION 'Payment attempt % cannot be settled from status %', p_provider_reference, v_attempt.status USING errcode = 'P0001';
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
    WHERE b.quote_id = v_quote.id;
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
  );

  INSERT INTO public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) VALUES (
    v_booking_id, v_quote.id, v_attempt.id, 'escrow_hold', 'PLATFORM_CASH', 'HOST_ESCROW_PAYABLE', v_quote.host_payout_amount, v_quote.currency,
    jsonb_build_object('host_id', v_quote.host_id, 'host_fee_amount', v_quote.host_service_fee_amount)
  );

  IF v_quote.host_service_fee_amount > 0 THEN
    INSERT INTO public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) VALUES (
      v_booking_id, v_quote.id, v_attempt.id, 'platform_fee_earned', 'PLATFORM_CASH', 'PLATFORM_REVENUE', v_quote.host_service_fee_amount, v_quote.currency,
      jsonb_build_object('host_id', v_quote.host_id)
    );
  END IF;

  -- Lifecycle audit log
  INSERT INTO public.booking_lifecycle_events (
    booking_id, from_status, to_status, actor_type, reason
  ) VALUES (
    v_booking_id, 'quote_locked', v_target_status, 'payment_provider', 'Payment verified and settled'
  );

  -- Schedule host payout if auto-confirmed
  IF v_target_status = 'confirmed' THEN
    PERFORM public.schedule_pending_host_payouts(v_quote.host_id);
  END IF;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_booking_review(uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_reviews_summary(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paystack_success(text, text, jsonb) TO service_role;
