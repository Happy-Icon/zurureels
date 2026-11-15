-- =============================================================================
-- Migration: 202611150004_offer_expiry_quote_guard.sql
-- Purpose:
--   1. Enforce server-side expiration guards inside create_booking_quote:
--      - Reject claiming/quoting any Special Offer whose status is not 'active'
--        or whose expires_at timestamp is <= now().
--      - Reject offer redemption dates (p_check_in) scheduled after expires_at.
--      - Reject quoting Events once the event has started/ended or is inactive.
--   2. Allow special offers (including stay_discount offers priced per night)
--      to accept claims up to max_guests instead of blocking on first claim.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_booking_quote(
  p_experience_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_guest_count integer,
  p_idempotency_key uuid,
  p_booking_meta jsonb DEFAULT '{}'::jsonb
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
  v_meta jsonb := COALESCE(p_booking_meta, '{}'::jsonb);
  v_exp_meta jsonb;
  v_content_type text;
  v_price_unit text;
  v_is_exclusive_stay boolean := true;
  v_is_night_unit boolean := false;
  v_is_flat_unit boolean := false;
  v_booked_guests integer := 0;
  v_units integer := 1;
  v_unit_price numeric := 0;
  v_tier_id text := nullif(trim(COALESCE(v_meta->>'ticket_tier_id', '')), '');
  v_tier_label text := nullif(trim(COALESCE(v_meta->>'ticket_tier_label', '')), '');
  v_tier_match jsonb;
  v_voucher_qty integer := 1;
  v_offer_id_raw text;
  v_offer_row record;
  v_offer_meta_expires_raw text;
  v_offer_expires_at timestamptz;
  v_event_id_raw text;
  v_event_row record;
  v_event_date_raw text;
  v_event_end_raw text;
  v_event_start_at timestamptz;
  v_event_end_at timestamptz;
  v_reel_expires_at timestamptz;
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
  v_time_slot text := nullif(trim(COALESCE(v_meta->>'time_slot', '')), '');
  v_seating_pref text := nullif(trim(COALESCE(v_meta->>'seating_preference', '')), '');
  v_special_requests text := nullif(trim(COALESCE(v_meta->>'special_requests', '')), '');
BEGIN
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'An idempotency key is required' USING errcode = '22023';
  END IF;
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in
     OR p_check_in < (now() - interval '1 day')
     OR p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > 50 THEN
    RAISE EXCEPTION 'Invalid booking dates or guest count' USING errcode = '22023';
  END IF;

  PERFORM public.expire_booking_quotes();

  SELECT * INTO v_quote FROM public.booking_quotes
  WHERE guest_id = v_guest_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_quote; END IF;

  -- Lock experience record
  SELECT e.id, e.user_id, e.title, e.category, e.subcategory, e.location, e.current_price, e.price_unit,
         e.availability_status, e.max_guests, e.min_stay_nights, e.max_stay_nights,
         e.check_in_time, e.check_out_time, e.booking_mode, e.cancellation_policy,
         e.house_rules, e.arrival_instructions, e.checkout_instructions, e.image_url,
         e.metadata
  INTO v_experience FROM public.experiences e
  WHERE e.id = p_experience_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found' USING errcode = 'P0002'; END IF;
  IF v_experience.user_id = v_guest_id THEN
    RAISE EXCEPTION 'Hosts cannot book their own listing' USING errcode = '22023';
  END IF;
  IF COALESCE(v_experience.availability_status, 'available') <> 'available' THEN
    RAISE EXCEPTION 'Listing is not available' USING errcode = 'P0001';
  END IF;

  v_exp_meta := COALESCE(v_experience.metadata, '{}'::jsonb);
  v_content_type := lower(COALESCE(
    nullif(v_exp_meta->>'content_type', ''),
    CASE
      WHEN lower(COALESCE(v_experience.category, '')) IN ('event', 'events') THEN 'event'
      WHEN lower(COALESCE(v_experience.category, '')) IN ('special_offer', 'offer', 'special_offers') THEN 'special_offer'
      ELSE 'experience'
    END
  ));

  -- Promotional reel fallback expiry timestamp (if any)
  SELECT r.expires_at INTO v_reel_expires_at
  FROM public.reels r
  WHERE r.experience_id = p_experience_id
    AND r.expires_at IS NOT NULL
  ORDER BY r.created_at DESC
  LIMIT 1;

  -- Special Offer expiry & active status guard
  IF v_content_type = 'special_offer' THEN
    v_offer_id_raw := nullif(trim(COALESCE(v_exp_meta->'offer_details'->>'offer_id', '')), '');
    IF v_offer_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT o.id, o.status, o.expires_at INTO v_offer_row
      FROM public.special_offers o
      WHERE o.id = v_offer_id_raw::uuid;

      IF FOUND THEN
        IF lower(COALESCE(v_offer_row.status, 'active')) <> 'active' THEN
          RAISE EXCEPTION 'This special offer is no longer active' USING errcode = 'P0001';
        END IF;
        v_offer_expires_at := v_offer_row.expires_at;
      END IF;
    END IF;

    IF v_offer_expires_at IS NULL THEN
      v_offer_meta_expires_raw := nullif(trim(COALESCE(v_exp_meta->'offer_details'->>'expires_at', '')), '');
      IF v_offer_meta_expires_raw IS NOT NULL AND v_offer_meta_expires_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
        BEGIN
          v_offer_expires_at := v_offer_meta_expires_raw::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_offer_expires_at := NULL;
        END;
      END IF;
    END IF;

    v_offer_expires_at := COALESCE(v_offer_expires_at, v_reel_expires_at);

    IF v_offer_expires_at IS NOT NULL AND v_offer_expires_at <= now() THEN
      RAISE EXCEPTION 'This special offer has expired and can no longer be claimed' USING errcode = 'P0001';
    END IF;

    IF v_offer_expires_at IS NOT NULL AND p_check_in > v_offer_expires_at THEN
      RAISE EXCEPTION 'Selected redemption date must be on or before the offer expiry' USING errcode = '22023';
    END IF;
  END IF;

  -- Event start/end guard (reservations close once live or ended)
  IF v_content_type = 'event' THEN
    v_event_id_raw := nullif(trim(COALESCE(v_exp_meta->'event_details'->>'event_id', '')), '');
    IF v_event_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT ev.id, ev.status, ev.event_date, ev.end_time INTO v_event_row
      FROM public.events ev
      WHERE ev.id = v_event_id_raw::uuid;

      IF FOUND THEN
        IF lower(COALESCE(v_event_row.status, 'active')) <> 'active' THEN
          RAISE EXCEPTION 'This event is no longer active' USING errcode = 'P0001';
        END IF;
        v_event_start_at := v_event_row.event_date;
        v_event_end_at := v_event_row.end_time;
      END IF;
    END IF;

    IF v_event_start_at IS NULL THEN
      v_event_date_raw := nullif(trim(COALESCE(v_exp_meta->'event_details'->>'event_date', '')), '');
      IF v_event_date_raw IS NOT NULL AND v_event_date_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
        BEGIN
          v_event_start_at := v_event_date_raw::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_event_start_at := NULL;
        END;
      END IF;
    END IF;

    IF v_event_end_at IS NULL THEN
      v_event_end_raw := nullif(trim(COALESCE(
        nullif(v_exp_meta->'event_details'->>'end_date', ''),
        v_exp_meta->'event_details'->>'expires_at'
      )), '');
      IF v_event_end_raw IS NOT NULL AND v_event_end_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
        BEGIN
          v_event_end_at := v_event_end_raw::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_event_end_at := NULL;
        END;
      END IF;
    END IF;

    v_event_end_at := COALESCE(v_event_end_at, v_reel_expires_at);

    IF (v_event_start_at IS NOT NULL AND v_event_start_at <= now())
       OR (v_event_end_at IS NOT NULL AND v_event_end_at <= now()) THEN
      RAISE EXCEPTION 'Ticket reservations close once the event starts or ends' USING errcode = 'P0001';
    END IF;
  END IF;

  v_price_unit := lower(COALESCE(nullif(trim(v_experience.price_unit), ''), 'night'));
  v_is_night_unit := v_price_unit IN ('night', 'nights', 'per_night');
  v_is_flat_unit := v_price_unit IN (
    'group', 'groups', 'per_group',
    'boat', 'boats', 'charter', 'charters',
    'trip', 'trips', 'booking', 'bookings',
    'table', 'tables',
    'offer', 'offers', 'package', 'packages', 'bundle', 'deal',
    'session', 'sessions', 'vehicle', 'vehicles'
  );

  v_is_exclusive_stay :=
    v_content_type NOT IN ('special_offer', 'event')
    AND lower(COALESCE(v_experience.category, '')) IN ('accommodation', 'hotel', 'villa', 'apartment', 'stay', 'stays')
    AND v_is_night_unit;

  -- Check max guests per booking (up to listing max_guests)
  IF v_experience.max_guests IS NOT NULL AND p_guest_count > v_experience.max_guests THEN
    RAISE EXCEPTION 'Guest count exceeds maximum capacity of % guests', v_experience.max_guests USING errcode = '22023';
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

  -- Verify availability against active bookings
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
      RAISE EXCEPTION 'Capacity reached (% spots remaining)', greatest(0, v_experience.max_guests - v_booked_guests) USING errcode = 'P0001';
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

  -- Authoritative ticket tier price resolution for Events (if tier selected)
  v_unit_price := COALESCE(v_experience.current_price, 0);
  IF v_content_type = 'event' AND v_tier_id IS NOT NULL AND jsonb_typeof(v_exp_meta->'event_details'->'ticket_tiers') = 'array' THEN
    SELECT elem INTO v_tier_match
    FROM jsonb_array_elements(v_exp_meta->'event_details'->'ticket_tiers') elem
    WHERE elem->>'id' = v_tier_id
    LIMIT 1;

    IF v_tier_match IS NOT NULL AND (v_tier_match->>'price') IS NOT NULL THEN
      v_unit_price := GREATEST(0, (v_tier_match->>'price')::numeric);
      v_tier_label := COALESCE(nullif(trim(v_tier_match->>'label'), ''), v_tier_label, v_tier_id);
    END IF;
  END IF;

  IF v_unit_price IS NULL OR v_unit_price < 0 THEN
    RAISE EXCEPTION 'Listing price is unavailable' USING errcode = 'P0001';
  END IF;

  -- Reuse an existing active unconsumed quote ONLY if dates, guest count, slot, and tier match
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
    AND COALESCE(bq.terms_snapshot->>'time_slot', '') = COALESCE(v_time_slot, '')
    AND COALESCE(bq.terms_snapshot->>'ticket_tier_id', '') = COALESCE(v_tier_id, '')
    AND COALESCE(bq.terms_snapshot->>'seating_preference', '') = COALESCE(v_seating_pref, '')
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

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'commission';
  IF v_setting ? 'host_fee_bps' THEN v_host_fee_bps := (v_setting->>'host_fee_bps')::integer; END IF;
  IF v_host_fee_bps < 0 OR v_host_fee_bps > 10000 THEN
    RAISE EXCEPTION 'Invalid platform commission configuration' USING errcode = 'P0001';
  END IF;

  -- Optional voucher qty for special offers / flat bundles
  IF (v_meta->>'voucher_qty') ~ '^\d+$' THEN
    v_voucher_qty := greatest(1, least(20, (v_meta->>'voucher_qty')::integer));
  END IF;

  -- Category-accurate unit calculation
  IF v_is_night_unit THEN
    v_units := greatest(1, ceil(extract(epoch from (p_check_out - p_check_in)) / 86400.0)::integer);
  ELSIF v_is_flat_unit THEN
    v_units := CASE WHEN v_content_type = 'special_offer' THEN v_voucher_qty ELSE 1 END;
  ELSE
    -- per_person, per_guest, per_ticket, entry, etc.
    v_units := p_guest_count;
  END IF;

  -- Enforce min stay nights strictly for night-based stays
  IF v_is_night_unit AND v_experience.min_stay_nights IS NOT NULL AND v_units < v_experience.min_stay_nights THEN
    RAISE EXCEPTION 'Minimum stay is % nights', v_experience.min_stay_nights USING errcode = '22023';
  END IF;

  v_subtotal := round(v_unit_price * v_units * 100)::bigint;
  v_host_fee := round(v_subtotal * (v_host_fee_bps / 10000.0))::bigint;

  -- Cancellation Policy Snapshot Calculation
  v_policy_type := COALESCE(v_experience.cancellation_policy, 'flexible');
  IF v_policy_type = 'strict' THEN
    v_free_cancellation_until := least(p_check_in - interval '7 days', now() + interval '48 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'strict',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 5000,
      'policy_note', 'Full refund if cancelled at least 7 days before start. 50% refund thereafter up to 48h before start.'
    );
  ELSIF v_policy_type = 'moderate' THEN
    v_free_cancellation_until := least(p_check_in - interval '5 days', now() + interval '48 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'moderate',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 5000,
      'policy_note', 'Full refund up to 5 days before start. Partial refund thereafter.'
    );
  ELSE
    v_free_cancellation_until := least(p_check_in - interval '24 hours', now() + interval '24 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'flexible',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 0,
      'policy_note', 'Full refund up to 24 hours before start. Non-refundable after start.'
    );
  END IF;

  SELECT full_name INTO v_host_profile FROM public.profiles WHERE id = v_experience.user_id;

  v_terms_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'title', v_experience.title,
    'category', v_experience.category,
    'subcategory', v_experience.subcategory,
    'content_type', v_content_type,
    'price_unit', v_price_unit,
    'unit_price', v_unit_price,
    'units', v_units,
    'location', v_experience.location,
    'host_name', COALESCE(v_host_profile.full_name, 'Host'),
    'check_in_time', COALESCE(v_time_slot, v_experience.check_in_time, '14:00'),
    'check_out_time', v_experience.check_out_time,
    'booking_mode', COALESCE(v_experience.booking_mode, 'approval_required'),
    'image_url', v_experience.image_url,
    'time_slot', v_time_slot,
    'seating_preference', v_seating_pref,
    'special_requests', v_special_requests,
    'ticket_tier_id', v_tier_id,
    'ticket_tier_label', v_tier_label,
    'duration_info', nullif(v_exp_meta->>'duration_info', ''),
    'meeting_point', nullif(v_exp_meta->>'meeting_point', ''),
    'discount_label', nullif(v_exp_meta->'offer_details'->>'discount_label', ''),
    'original_price', CASE
      WHEN (v_exp_meta->'offer_details'->>'original_price') IS NOT NULL
      THEN (v_exp_meta->'offer_details'->>'original_price')::numeric
      ELSE NULL
    END
  ));

  v_house_rules_snapshot := COALESCE(v_experience.house_rules, '{}'::jsonb);
  v_arrival_snapshot := COALESCE(v_experience.arrival_instructions, '{}'::jsonb);
  v_checkout_snapshot := COALESCE(v_experience.checkout_instructions, '{}'::jsonb);

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
    jsonb_build_object(
      'listing_unit_price', v_unit_price,
      'listing_price_unit', v_price_unit,
      'units', v_units,
      'currency', 'KES',
      'price_scale', 100,
      'host_fee_bps', v_host_fee_bps
    ),
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

GRANT EXECUTE ON FUNCTION public.create_booking_quote(uuid, timestamptz, timestamptz, integer, uuid, jsonb) TO authenticated;
