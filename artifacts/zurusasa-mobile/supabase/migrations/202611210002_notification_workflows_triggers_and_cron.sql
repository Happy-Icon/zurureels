-- =============================================================================
-- Migration: 202611210002_notification_workflows_triggers_and_cron.sql
-- Purpose:
--   Phase 0 & Phase 2 Server-Side Workflow Wiring, Policy-Accurate Refunds,
--   Message Trigger & pg_cron/pg_net Automated Schedules:
--     1. host_confirm_booking -> enqueues critical in_app + push + email
--     2. host_decline_booking -> enqueues critical in_app + push + email
--     3. guest_cancel_booking -> enforces cancellation_policy_snapshot refund tiers
--        + enqueues critical in_app + push + email for both host & guest
--     4. host_check_in_booking, guest_check_in_booking, report_booking_arrival_issue
--        -> enqueue deduplicated multi-channel events
--     5. AFTER INSERT ON public.messages trigger -> enqueues in_app + push for recipient
--     6. Safe pg_cron + pg_net scheduled job registration (guarded if extensions missing)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. host_confirm_booking (paid -> confirmed) with Multi-Channel Enqueue
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.host_confirm_booking(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_trip_title text;
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  IF NOT public.is_booking_host(p_booking_id, v_host_id) THEN
    RAISE EXCEPTION 'You are not authorized to manage this booking' USING errcode = '42501';
  END IF;

  IF v_booking.status = 'confirmed' THEN
    RETURN v_booking;
  END IF;

  IF v_booking.status <> 'paid' THEN
    RAISE EXCEPTION 'Only a paid booking can be confirmed' USING errcode = 'P0001';
  END IF;

  UPDATE public.bookings
  SET status = 'confirmed', updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'confirmed', updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  BEGIN
    PERFORM set_config('app.internal_rpc_trusted', 'true', true);
    PERFORM public.schedule_pending_host_payouts(v_host_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.booking_lifecycle_events (booking_id, from_status, to_status, actor_id, actor_type)
  VALUES (v_booking.id, 'paid', 'confirmed', v_host_id, 'host');

  v_trip_title := COALESCE(nullif(trim(v_booking.trip_title), ''), 'your reservation');

  IF v_booking.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification_event(
        p_user_id => v_booking.user_id,
        p_type => 'booking_confirmed',
        p_template_key => 'booking_confirmed',
        p_title => 'Reservation Confirmed!',
        p_message => 'Your reservation for "' || v_trip_title || '" was confirmed by the host.',
        p_dedupe_key => 'booking_confirmed:' || v_booking.id::text || ':' || v_booking.user_id::text,
        p_priority => 'critical',
        p_channels => ARRAY['in_app', 'push', 'email'],
        p_action_type => 'booking',
        p_action_id => v_booking.id::text,
        p_payload => jsonb_build_object(
          'booking_id', v_booking.id,
          'trip_title', v_trip_title,
          'amount', COALESCE(v_booking.amount, 0),
          'check_in', v_booking.check_in,
          'check_out', v_booking.check_out,
          'guests', COALESCE(v_booking.guests, 1)
        ),
        p_sender_id => v_host_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. host_decline_booking (paid/confirmed -> refund_pending or cancelled)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.host_decline_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_is_auth boolean;
  v_target_status text := 'cancelled';
  v_trip_title text;
  v_clean_reason text := nullif(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  v_is_auth := public.is_booking_host(p_booking_id, v_host_id);
  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'You are not authorized to manage this booking' USING errcode = '42501';
  END IF;

  IF v_booking.status IN ('cancelled', 'declined', 'completed', 'refunded', 'refund_pending') THEN
    RETURN v_booking;
  END IF;

  UPDATE public.host_payouts
  SET status = 'cancelled',
      failure_reason = COALESCE(v_clean_reason, 'Reservation declined by host'),
      updated_at = now()
  WHERE booking_id = v_booking.id AND status IN ('scheduled', 'on_hold');

  IF v_booking.status IN ('paid', 'confirmed') AND v_booking.quote_id IS NOT NULL THEN
    v_target_status := 'refund_pending';

    SELECT bq.* INTO v_quote
    FROM public.booking_quotes bq
    WHERE bq.id = v_booking.quote_id;

    IF FOUND AND v_quote.total_amount > 0 THEN
      INSERT INTO public.refund_requests (
        booking_id,
        quote_id,
        payment_attempt_id,
        guest_id,
        amount,
        currency,
        reason,
        status
      ) VALUES (
        v_booking.id,
        v_quote.id,
        v_booking.payment_attempt_id,
        v_booking.user_id,
        v_quote.total_amount,
        v_quote.currency,
        COALESCE(v_clean_reason, 'Host declined reservation'),
        'pending'
      ) ON CONFLICT DO NOTHING;

      INSERT INTO public.financial_ledger (
        booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
      ) VALUES (
        v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
        'HOST_ESCROW_PAYABLE', 'PLATFORM_CASH', v_quote.host_payout_amount, v_quote.currency,
        jsonb_build_object('cancellation_by', 'host', 'reason', v_clean_reason)
      );

      IF v_quote.host_service_fee_amount > 0 THEN
        INSERT INTO public.financial_ledger (
          booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
        ) VALUES (
          v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
          'PLATFORM_SERVICE_FEE_REVENUE', 'PLATFORM_CASH', v_quote.host_service_fee_amount, v_quote.currency,
          jsonb_build_object('cancellation_by', 'host', 'fee_reversal', true)
        );
      END IF;
    ELSIF FOUND AND v_quote.total_amount = 0 THEN
      v_target_status := 'declined';
    END IF;
  END IF;

  INSERT INTO public.booking_lifecycle_events (booking_id, from_status, to_status, actor_id, actor_type, reason)
  VALUES (v_booking.id, v_booking.status, v_target_status, v_host_id, 'host', v_clean_reason);

  UPDATE public.bookings
  SET status = v_target_status,
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  v_trip_title := COALESCE(nullif(trim(v_booking.trip_title), ''), 'your reservation');

  IF v_booking.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification_event(
        p_user_id => v_booking.user_id,
        p_type => 'booking_declined',
        p_template_key => 'booking_declined',
        p_title => 'Reservation Declined',
        p_message => 'Your reservation for "' || v_trip_title || '" could not be accommodated by the host.' ||
          CASE WHEN v_target_status = 'refund_pending' THEN ' A full refund has been initiated.' ELSE '' END,
        p_dedupe_key => 'booking_declined:' || v_booking.id::text || ':' || v_booking.user_id::text,
        p_priority => 'critical',
        p_channels => ARRAY['in_app', 'push', 'email'],
        p_action_type => 'booking',
        p_action_id => v_booking.id::text,
        p_payload => jsonb_build_object(
          'booking_id', v_booking.id,
          'trip_title', v_trip_title,
          'reason', v_clean_reason,
          'refund_initiated', v_target_status = 'refund_pending'
        ),
        p_sender_id => v_host_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. guest_cancel_booking — Policy-Aware Refunds + Dual Host & Guest Alerts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guest_cancel_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_host_id uuid;
  v_target_status text := 'cancelled';
  v_trip_title text;
  v_clean_reason text := nullif(trim(COALESCE(p_reason, '')), '');
  v_policy_snap jsonb;
  v_free_until_raw text;
  v_free_until timestamptz;
  v_after_bps integer := 10000;
  v_refund_bps integer := 10000;
  v_refund_amount bigint := 0;
  v_host_debit bigint := 0;
  v_fee_debit bigint := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  IF v_booking.user_id <> v_user_id THEN
    RAISE EXCEPTION 'You are not authorized to cancel this booking' USING errcode = '42501';
  END IF;

  IF v_booking.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'This reservation has already been checked in and cannot be cancelled. If you are experiencing a problem at the property, please use Report Arrival Issue.' USING errcode = 'P0001';
  END IF;

  IF v_booking.status IN ('cancelled', 'declined', 'completed', 'refunded', 'refund_pending') THEN
    RETURN v_booking;
  END IF;

  -- Cancel scheduled or held payouts
  UPDATE public.host_payouts
  SET status = 'cancelled',
      failure_reason = COALESCE(v_clean_reason, 'Guest cancelled reservation'),
      updated_at = now()
  WHERE booking_id = v_booking.id AND status IN ('scheduled', 'on_hold');

  -- Evaluate cancellation policy snapshot for paid/confirmed bookings
  IF v_booking.status IN ('paid', 'confirmed') AND v_booking.quote_id IS NOT NULL THEN
    SELECT bq.* INTO v_quote
    FROM public.booking_quotes bq
    WHERE bq.id = v_booking.quote_id;

    IF FOUND AND v_quote.total_amount > 0 THEN
      v_policy_snap := COALESCE(v_booking.cancellation_policy_snapshot, v_quote.cancellation_policy_snapshot, '{}'::jsonb);
      v_free_until_raw := nullif(trim(COALESCE(v_policy_snap->>'free_cancellation_until', '')), '');

      IF v_free_until_raw IS NOT NULL THEN
        BEGIN
          v_free_until := v_free_until_raw::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_free_until := NULL;
        END;
      END IF;

      IF (v_policy_snap->>'after_free_cancellation_refund_bps') ~ '^\d+$' THEN
        v_after_bps := least(10000, greatest(0, (v_policy_snap->>'after_free_cancellation_refund_bps')::integer));
      ELSE
        v_after_bps := 10000;
      END IF;

      -- Policy rules:
      --  - Before host accepts ('paid'), guest always receives 100% refund.
      --  - On or after check-in start, 0% refund.
      --  - Before free_cancellation_until (or when no cutoff snapshot exists), 100% refund.
      --  - Between free_cancellation_until and check-in, apply after_free_cancellation_refund_bps.
      IF v_booking.status = 'paid' THEN
        v_refund_bps := 10000;
      ELSIF v_booking.check_in IS NOT NULL AND now() >= v_booking.check_in THEN
        v_refund_bps := 0;
      ELSIF v_free_until IS NULL OR now() <= v_free_until THEN
        v_refund_bps := 10000;
      ELSE
        v_refund_bps := v_after_bps;
      END IF;

      v_refund_amount := round(v_quote.total_amount * (v_refund_bps / 10000.0))::bigint;

      IF v_refund_amount > 0 THEN
        v_target_status := 'refund_pending';
        v_host_debit := round(v_quote.host_payout_amount * (v_refund_bps / 10000.0))::bigint;
        v_fee_debit := greatest(0, v_refund_amount - v_host_debit);

        INSERT INTO public.refund_requests (
          booking_id,
          quote_id,
          payment_attempt_id,
          guest_id,
          amount,
          currency,
          reason,
          status
        ) VALUES (
          v_booking.id,
          v_quote.id,
          v_booking.payment_attempt_id,
          v_user_id,
          v_refund_amount,
          v_quote.currency,
          COALESCE(v_clean_reason, 'Guest requested cancellation'),
          'pending'
        ) ON CONFLICT DO NOTHING;

        IF v_host_debit > 0 THEN
          INSERT INTO public.financial_ledger (
            booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
          ) VALUES (
            v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
            'HOST_ESCROW_PAYABLE', 'PLATFORM_CASH', v_host_debit, v_quote.currency,
            jsonb_build_object('cancellation_by', 'guest', 'refund_bps', v_refund_bps, 'reason', v_clean_reason)
          );
        END IF;

        IF v_fee_debit > 0 THEN
          INSERT INTO public.financial_ledger (
            booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
          ) VALUES (
            v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
            'PLATFORM_SERVICE_FEE_REVENUE', 'PLATFORM_CASH', v_fee_debit, v_quote.currency,
            jsonb_build_object('cancellation_by', 'guest', 'refund_bps', v_refund_bps, 'fee_reversal', true)
          );
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.booking_lifecycle_events (booking_id, from_status, to_status, actor_id, actor_type, reason)
  VALUES (v_booking.id, v_booking.status, v_target_status, v_user_id, 'guest', v_clean_reason);

  UPDATE public.bookings
  SET status = v_target_status,
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  v_trip_title := COALESCE(nullif(trim(v_booking.trip_title), ''), 'your reservation');

  SELECT COALESCE(v_quote.host_id, e.user_id) INTO v_host_id
  FROM public.experiences e
  WHERE e.id = v_booking.experience_id;

  -- Notify host (critical: in_app + push + email)
  IF v_host_id IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification_event(
        p_user_id => v_host_id,
        p_type => 'booking_cancelled',
        p_template_key => 'booking_cancelled_host',
        p_title => 'Reservation Cancelled',
        p_message => 'Reservation for "' || v_trip_title || '" was cancelled by the guest.',
        p_dedupe_key => 'booking_cancelled:' || v_booking.id::text || ':' || v_host_id::text,
        p_priority => 'critical',
        p_channels => ARRAY['in_app', 'push', 'email'],
        p_action_type => 'booking',
        p_action_id => v_booking.id::text,
        p_payload => jsonb_build_object(
          'booking_id', v_booking.id,
          'trip_title', v_trip_title,
          'reason', v_clean_reason,
          'refund_amount_minor', v_refund_amount,
          'refund_bps', v_refund_bps
        ),
        p_sender_id => v_user_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Notify guest confirmation of cancellation (critical: in_app + push + email)
  BEGIN
    PERFORM public.enqueue_notification_event(
      p_user_id => v_user_id,
      p_type => 'booking_cancelled',
      p_template_key => 'booking_cancelled_guest',
      p_title => 'Reservation Cancelled',
      p_message => 'Your reservation for "' || v_trip_title || '" has been cancelled.' ||
        CASE
          WHEN v_refund_amount > 0 THEN ' Your refund of KES ' || round(v_refund_amount / 100.0)::text || ' is being processed.'
          ELSE ''
        END,
      p_dedupe_key => 'booking_cancelled:' || v_booking.id::text || ':' || v_user_id::text,
      p_priority => 'critical',
      p_channels => ARRAY['in_app', 'push', 'email'],
      p_action_type => 'booking',
      p_action_id => v_booking.id::text,
      p_payload => jsonb_build_object(
        'booking_id', v_booking.id,
        'trip_title', v_trip_title,
        'reason', v_clean_reason,
        'refund_amount_minor', v_refund_amount,
        'refund_bps', v_refund_bps
      ),
      p_sender_id => v_user_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_booking;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Update Check-In & Arrival Issue RPCs to Use Unified Outbox
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.host_check_in_booking(
  p_booking_id uuid,
  p_pin text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_expected_code text;
  v_clean_pin text;
  v_listing_tz text := 'Africa/Nairobi';
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  IF NOT public.is_booking_host(p_booking_id, v_host_id) THEN
    RAISE EXCEPTION 'You are not authorized to check in this booking' USING errcode = '42501';
  END IF;

  IF v_booking.arrival_issue_status = 'open' THEN
    RAISE EXCEPTION 'Cannot complete check-in while an arrival issue is under review' USING errcode = 'P0001';
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed bookings can be checked in' USING errcode = 'P0001';
  END IF;

  IF v_booking.checked_in_at IS NOT NULL THEN
    RETURN v_booking;
  END IF;

  SELECT COALESCE(nullif(trim(e.timezone), ''), 'Africa/Nairobi') INTO v_listing_tz
  FROM public.experiences e WHERE e.id = v_booking.experience_id;

  IF v_booking.check_in IS NOT NULL
     AND timezone(v_listing_tz, now()) < (timezone(v_listing_tz, v_booking.check_in)::date + time '06:00') THEN
    RAISE EXCEPTION 'Check-in opens at 6:00 AM on the scheduled check-in date' USING errcode = 'P0001';
  END IF;

  v_clean_pin := regexp_replace(COALESCE(p_pin, ''), '\D', '', 'g');

  SELECT c.code INTO v_expected_code
  FROM public.booking_check_in_codes c
  WHERE c.booking_id = p_booking_id;

  IF v_expected_code IS NULL OR v_clean_pin <> v_expected_code THEN
    RAISE EXCEPTION 'Invalid 6-digit Check-In PIN. Please ask the guest for their arrival code.' USING errcode = 'P0001';
  END IF;

  UPDATE public.bookings
  SET checked_in_at = now(),
      checked_in_by = 'host',
      check_in_method = 'pin_verified',
      check_in_metadata = COALESCE(check_in_metadata, '{}'::jsonb) || jsonb_build_object(
        'verified_by', v_host_id,
        'verified_at', now()
      ),
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  UPDATE public.host_payouts
  SET scheduled_for = greatest(now(), v_booking.checked_in_at + interval '24 hours'),
      updated_at = now()
  WHERE booking_id = v_booking.id
    AND status = 'scheduled';

  BEGIN
    PERFORM set_config('app.internal_rpc_trusted', 'true', true);
    PERFORM public.schedule_pending_host_payouts(v_host_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.booking_lifecycle_events (
    booking_id, from_status, to_status, actor_id, actor_type, reason
  ) VALUES (
    v_booking.id, 'confirmed', 'checked_in', v_host_id, 'host', 'Host verified 6-digit guest PIN'
  );

  IF v_booking.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification_event(
        p_user_id => v_booking.user_id,
        p_type => 'booking_checked_in',
        p_template_key => 'booking_checked_in',
        p_title => 'Check-In Verified!',
        p_message => 'Your host has verified your arrival for "' || COALESCE(v_booking.trip_title, 'your booking') || '". Enjoy your experience!',
        p_dedupe_key => 'booking_checked_in:' || v_booking.id::text || ':' || v_booking.user_id::text,
        p_priority => 'normal',
        p_channels => ARRAY['in_app', 'push'],
        p_action_type => 'booking',
        p_action_id => v_booking.id::text,
        p_payload => jsonb_build_object('booking_id', v_booking.id, 'method', 'pin_verified'),
        p_sender_id => v_host_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_check_in_booking(
  p_booking_id uuid,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_distance_meters integer DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_host_id uuid;
  v_gps_verified boolean;
  v_listing_tz text := 'Africa/Nairobi';
BEGIN
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  IF v_booking.user_id IS DISTINCT FROM v_guest_id THEN
    RAISE EXCEPTION 'You are not authorized to check in this booking' USING errcode = '42501';
  END IF;

  IF v_booking.arrival_issue_status = 'open' THEN
    RAISE EXCEPTION 'Cannot check in while an arrival issue is open' USING errcode = 'P0001';
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed bookings can be checked in' USING errcode = 'P0001';
  END IF;

  IF v_booking.checked_in_at IS NOT NULL THEN
    RETURN v_booking;
  END IF;

  SELECT COALESCE(nullif(trim(e.timezone), ''), 'Africa/Nairobi') INTO v_listing_tz
  FROM public.experiences e WHERE e.id = v_booking.experience_id;

  IF v_booking.check_in IS NOT NULL
     AND timezone(v_listing_tz, now()) < (timezone(v_listing_tz, v_booking.check_in)::date + time '06:00') THEN
    RAISE EXCEPTION 'Check-in opens at 6:00 AM on the scheduled check-in date' USING errcode = 'P0001';
  END IF;

  v_gps_verified := (p_distance_meters IS NOT NULL AND p_distance_meters <= 1500);

  UPDATE public.bookings
  SET checked_in_at = now(),
      checked_in_by = 'guest',
      check_in_method = 'guest_self_checkin',
      check_in_metadata = COALESCE(check_in_metadata, '{}'::jsonb) || jsonb_build_object(
        'latitude', p_latitude,
        'longitude', p_longitude,
        'distance_meters', p_distance_meters,
        'gps_verified', v_gps_verified,
        'checked_in_at', now()
      ),
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  SELECT COALESCE(q.host_id, e.user_id) INTO v_host_id
  FROM public.bookings b
  LEFT JOIN public.booking_quotes q ON q.id = b.quote_id
  LEFT JOIN public.experiences e ON e.id = b.experience_id
  WHERE b.id = v_booking.id;

  UPDATE public.host_payouts
  SET scheduled_for = greatest(now(), v_booking.checked_in_at + interval '24 hours'),
      updated_at = now()
  WHERE booking_id = v_booking.id
    AND status = 'scheduled';

  IF v_host_id IS NOT NULL THEN
    BEGIN
      PERFORM set_config('app.internal_rpc_trusted', 'true', true);
      PERFORM public.schedule_pending_host_payouts(v_host_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  INSERT INTO public.booking_lifecycle_events (
    booking_id, from_status, to_status, actor_id, actor_type, reason
  ) VALUES (
    v_booking.id,
    'confirmed',
    'checked_in',
    v_guest_id,
    'guest',
    CASE
      WHEN v_gps_verified THEN 'Guest self check-in verified by GPS proximity'
      ELSE 'Guest self check-in completed via app'
    END
  );

  IF v_host_id IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification_event(
        p_user_id => v_host_id,
        p_type => 'booking_checked_in',
        p_template_key => 'booking_checked_in',
        p_title => 'Guest Checked In!',
        p_message => 'Your guest has checked in to "' || COALESCE(v_booking.trip_title, 'your property') || '". Your payout is scheduled for release after completion.',
        p_dedupe_key => 'booking_checked_in:' || v_booking.id::text || ':' || v_host_id::text,
        p_priority => 'normal',
        p_channels => ARRAY['in_app', 'push'],
        p_action_type => 'booking',
        p_action_id => v_booking.id::text,
        p_payload => jsonb_build_object(
          'booking_id', v_booking.id,
          'method', 'guest_self_checkin',
          'gps_verified', v_gps_verified
        ),
        p_sender_id => v_guest_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_booking_arrival_issue(
  p_booking_id uuid,
  p_reason text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_host_id uuid;
  v_reason text;
BEGIN
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  IF v_booking.user_id IS DISTINCT FROM v_guest_id THEN
    RAISE EXCEPTION 'You are not authorized to report an issue for this booking' USING errcode = '42501';
  END IF;

  IF v_booking.arrival_issue_status = 'open' THEN
    RETURN v_booking;
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed bookings are eligible for arrival issue reporting' USING errcode = 'P0001';
  END IF;

  IF v_booking.checked_in_at IS NOT NULL AND now() > v_booking.checked_in_at + interval '24 hours' THEN
    RAISE EXCEPTION 'The 24-hour arrival issue reporting window has expired.' USING errcode = 'P0001';
  END IF;

  v_reason := COALESCE(NULLIF(trim(p_reason), ''), 'Arrival issue reported by guest');

  UPDATE public.bookings
  SET arrival_issue_reported_at = now(),
      arrival_issue_reason = v_reason,
      arrival_issue_status = 'open',
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  UPDATE public.host_payouts
  SET status = 'on_hold',
      failure_reason = 'Paused: Guest reported arrival issue — ' || v_reason,
      updated_at = now()
  WHERE booking_id = v_booking.id
    AND status = 'scheduled';

  INSERT INTO public.booking_lifecycle_events (
    booking_id, from_status, to_status, actor_id, actor_type, reason
  ) VALUES (
    v_booking.id, 'confirmed', 'arrival_issue_open', v_guest_id, 'guest', v_reason
  );

  SELECT COALESCE(q.host_id, e.user_id) INTO v_host_id
  FROM public.bookings b
  LEFT JOIN public.booking_quotes q ON q.id = b.quote_id
  LEFT JOIN public.experiences e ON e.id = b.experience_id
  WHERE b.id = v_booking.id;

  IF v_host_id IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification_event(
        p_user_id => v_host_id,
        p_type => 'arrival_issue_reported',
        p_template_key => 'arrival_issue_reported',
        p_title => 'Arrival Issue Reported — Payout Paused',
        p_message => 'The guest reported an arrival issue for "' || COALESCE(v_booking.trip_title, 'your booking') || '": ' || v_reason || '. Host payout is paused pending review.',
        p_dedupe_key => 'arrival_issue:' || v_booking.id::text || ':' || v_host_id::text,
        p_priority => 'critical',
        p_channels => ARRAY['in_app', 'push', 'email'],
        p_action_type => 'booking',
        p_action_id => v_booking.id::text,
        p_payload => jsonb_build_object(
          'booking_id', v_booking.id,
          'trip_title', COALESCE(v_booking.trip_title, 'Booking'),
          'reason', v_reason
        ),
        p_sender_id => v_guest_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. AFTER INSERT Trigger on public.messages -> Server-Side Message Notification
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_new_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_recipient_id uuid;
  v_sender_name text;
  v_preview text;
BEGIN
  SELECT participant_one, participant_two
  INTO v_conv
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_conv.participant_one = NEW.sender_id THEN
    v_recipient_id := v_conv.participant_two;
  ELSIF v_conv.participant_two = NEW.sender_id THEN
    v_recipient_id := v_conv.participant_one;
  ELSE
    RETURN NEW;
  END IF;

  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nullif(trim(full_name), ''), 'Someone')
  INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  v_sender_name := COALESCE(v_sender_name, 'Someone');

  IF NEW.content IS NOT NULL AND (
    NEW.content LIKE 'https://res.cloudinary.com%'
    OR (NEW.content LIKE 'http%' AND (
      NEW.content ILIKE '%/image/%'
      OR NEW.content ILIKE '%/upload/%'
      OR NEW.content ~* '\.(jpg|jpeg|png|webp|gif)(\?|$)'
    ))
  ) THEN
    v_preview := 'Sent a photo';
  ELSE
    v_preview := left(regexp_replace(COALESCE(NEW.content, 'New message'), '\s+', ' ', 'g'), 140);
  END IF;

  BEGIN
    PERFORM public.enqueue_notification_event(
      p_user_id => v_recipient_id,
      p_type => 'message',
      p_template_key => 'new_message',
      p_title => 'New message from ' || v_sender_name,
      p_message => v_preview,
      p_dedupe_key => 'message:' || NEW.id::text || ':' || v_recipient_id::text,
      p_priority => 'normal',
      p_channels => ARRAY['in_app', 'push'],
      p_action_type => 'chat',
      p_action_id => NEW.conversation_id::text,
      p_payload => jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'sender_name', v_sender_name,
        'preview', v_preview
      ),
      p_sender_id => NEW.sender_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_new_message_notification ON public.messages;
CREATE TRIGGER trg_enqueue_new_message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_new_message_notification();

-- -----------------------------------------------------------------------------
-- 6. pg_cron & pg_net Scheduled Job Registration (Safe & Idempotent)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_zurusasa_worker(
  p_function_name text,
  p_body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_cron_secret text;
  v_request_id bigint := NULL;
BEGIN
  -- Attempt Supabase Vault lookup first, then GUC fallback
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'vault' AND c.relname = 'decrypted_secrets') THEN
    EXECUTE $q$SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_supabase_url' LIMIT 1$q$ INTO v_supabase_url;
    EXECUTE $q$SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1$q$ INTO v_cron_secret;
  END IF;

  v_supabase_url := COALESCE(nullif(trim(v_supabase_url), ''), nullif(trim(current_setting('app.settings.supabase_url', true)), ''));
  v_cron_secret := COALESCE(nullif(trim(v_cron_secret), ''), nullif(trim(current_setting('app.settings.cron_secret', true)), ''));

  IF v_supabase_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE NOTICE '[invoke_zurusasa_worker] Vault secrets app_supabase_url / cron_secret not configured; skipping %', p_function_name;
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    EXECUTE $q$
      SELECT net.http_post(
        url := $1,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', $2
        ),
        body := $3
      )
    $q$
    INTO v_request_id
    USING (rtrim(v_supabase_url, '/') || '/functions/v1/' || p_function_name), v_cron_secret, COALESCE(p_body, '{}'::jsonb);
  END IF;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_zurusasa_worker(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_zurusasa_worker(text, jsonb) TO service_role;

DO $cron$
DECLARE
  v_job record;
  v_job_names text[] := ARRAY[
    'zurusasa-process-notification-queue',
    'zurusasa-process-booking-reminders',
    'zurusasa-process-host-payouts',
    'zurusasa-process-booking-refunds',
    'zurusasa-expire-booking-quotes',
    'zurusasa-cleanup-personal-data-exports'
  ];
  v_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOREACH v_name IN ARRAY v_job_names LOOP
      FOR v_job IN EXECUTE 'SELECT jobid FROM cron.job WHERE jobname = $1' USING v_name LOOP
        EXECUTE 'SELECT cron.unschedule($1)' USING v_job.jobid;
      END LOOP;
    END LOOP;

    PERFORM cron.schedule('zurusasa-process-notification-queue', '* * * * *', $cmd$SELECT public.invoke_zurusasa_worker('process-notification-queue');$cmd$);
    PERFORM cron.schedule('zurusasa-process-booking-reminders', '*/5 * * * *', $cmd$SELECT public.invoke_zurusasa_worker('process-booking-reminders');$cmd$);
    PERFORM cron.schedule('zurusasa-process-host-payouts', '*/15 * * * *', $cmd$SELECT public.invoke_zurusasa_worker('process-host-payouts');$cmd$);
    PERFORM cron.schedule('zurusasa-process-booking-refunds', '*/15 * * * *', $cmd$SELECT public.invoke_zurusasa_worker('process-booking-refund');$cmd$);
    PERFORM cron.schedule('zurusasa-expire-booking-quotes', '*/5 * * * *', $cmd$SELECT public.expire_booking_quotes();$cmd$);
    PERFORM cron.schedule('zurusasa-cleanup-personal-data-exports', '0 3 * * *', $cmd$SELECT public.invoke_zurusasa_worker('cleanup-personal-data-exports');$cmd$);
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled in this database; enable pg_cron and pg_net in Supabase Dashboard and re-run schedule block.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping pg_cron schedule registration: %', SQLERRM;
END
$cron$;

NOTIFY pgrst, 'reload schema';
