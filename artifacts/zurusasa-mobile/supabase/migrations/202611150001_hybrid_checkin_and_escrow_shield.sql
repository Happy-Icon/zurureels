-- =============================================================================
-- Migration: 202611150001_hybrid_checkin_and_escrow_shield.sql
-- Description:
--   3-Layer Hybrid Check-In & Escrow Protection System:
--     1. Check-in tracking & arrival issue freeze columns on public.bookings
--     2. Guest-only secret 6-digit arrival PIN table (booking_check_in_codes) + auto-generation trigger & backfill
--     3. 'on_hold' status on public.host_payouts
--     4. Secure RPCs: get_guest_check_in_code, host_check_in_booking, guest_check_in_booking, report_booking_arrival_issue
--     5. Updated schedule_pending_host_payouts (24h post-check-in release & arrival issue exclusion)
--     6. Guarded guest_cancel_booking (prevents self-cancel once checked in)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend public.bookings with Check-In & Arrival Issue columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by text CHECK (checked_in_by IN ('guest', 'host')),
  ADD COLUMN IF NOT EXISTS check_in_method text CHECK (check_in_method IN ('pin_verified', 'guest_self_checkin')),
  ADD COLUMN IF NOT EXISTS check_in_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS arrival_issue_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_issue_reason text,
  ADD COLUMN IF NOT EXISTS arrival_issue_status text CHECK (arrival_issue_status IN ('open', 'resolved', 'dismissed'));

-- -----------------------------------------------------------------------------
-- 2. Allow 'on_hold' in public.host_payouts status constraint
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_con record;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.host_payouts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.host_payouts DROP CONSTRAINT IF EXISTS %I', v_con.conname);
  END LOOP;
END
$$;

ALTER TABLE public.host_payouts
  ADD CONSTRAINT host_payouts_status_check
  CHECK (status IN ('scheduled', 'on_hold', 'processing', 'success', 'failed', 'cancelled'));

-- Ensure unique active index also covers 'on_hold' payouts so duplicate payouts are never inserted
DROP INDEX IF EXISTS public.host_payouts_active_booking_idx;
CREATE UNIQUE INDEX IF NOT EXISTS host_payouts_active_booking_idx
  ON public.host_payouts (booking_id)
  WHERE status IN ('scheduled', 'on_hold', 'processing', 'success');

-- -----------------------------------------------------------------------------
-- 3. Guest-Only 6-Digit Check-In Codes Table + RLS + Trigger + Backfill
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_check_in_codes (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^\d{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_check_in_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.booking_check_in_codes FROM anon;

DROP POLICY IF EXISTS "Guests can read their own booking check-in code" ON public.booking_check_in_codes;
CREATE POLICY "Guests can read their own booking check-in code"
  ON public.booking_check_in_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = guest_id);

CREATE OR REPLACE FUNCTION public.ensure_booking_check_in_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.status IN ('paid', 'confirmed', 'completed') THEN
    INSERT INTO public.booking_check_in_codes (booking_id, guest_id, code)
    VALUES (
      NEW.id,
      NEW.user_id,
      lpad((floor(random() * 900000) + 100000)::int::text, 6, '0')
    )
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_booking_check_in_code ON public.bookings;
CREATE TRIGGER trg_ensure_booking_check_in_code
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_booking_check_in_code();

-- Backfill existing bookings that do not yet have a check-in PIN
INSERT INTO public.booking_check_in_codes (booking_id, guest_id, code)
SELECT
  b.id,
  b.user_id,
  lpad((floor(random() * 900000) + 100000)::int::text, 6, '0')
FROM public.bookings b
WHERE b.user_id IS NOT NULL
ON CONFLICT (booking_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. RPC: get_guest_check_in_code(p_booking_id uuid)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_guest_check_in_code(p_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  IF v_booking.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Only the booking guest can view the arrival PIN' USING errcode = '42501';
  END IF;

  SELECT c.code INTO v_code
  FROM public.booking_check_in_codes c
  WHERE c.booking_id = p_booking_id;

  IF v_code IS NULL THEN
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    INSERT INTO public.booking_check_in_codes (booking_id, guest_id, code)
    VALUES (v_booking.id, v_booking.user_id, v_code)
    ON CONFLICT (booking_id) DO NOTHING;

    SELECT c.code INTO v_code
    FROM public.booking_check_in_codes c
    WHERE c.booking_id = p_booking_id;
  END IF;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_check_in_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_guest_check_in_code(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Update schedule_pending_host_payouts (24h Post-Check-In & Escrow Hold Safe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_pending_host_payouts(p_host_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_trusted_internal boolean := COALESCE(current_setting('app.internal_rpc_trusted', true), '') = 'true';
  v_is_admin_session boolean := session_user IN ('postgres', 'supabase_admin');
  v_recipient record;
  v_booking record;
  v_scheduled_for timestamptz;
  v_count integer := 0;
BEGIN
  IF p_host_id IS NULL THEN
    RAISE EXCEPTION 'Host ID is required' USING errcode = '22023';
  END IF;

  -- Authorize caller: service_role, trusted internal RPC, DB superuser session, or the host themselves
  IF NOT (v_jwt_role = 'service_role' OR v_trusted_internal OR v_is_admin_session) THEN
    IF v_jwt_role <> 'authenticated' OR auth.uid() IS DISTINCT FROM p_host_id THEN
      RAISE EXCEPTION 'Forbidden: not authorized to schedule payouts for another host' USING errcode = '42501';
    END IF;
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

  -- Update already-scheduled payouts for bookings that now have a verified check-in timestamp
  UPDATE public.host_payouts hp
  SET scheduled_for = greatest(now(), b.checked_in_at + interval '24 hours'),
      updated_at = now()
  FROM public.bookings b
  WHERE hp.booking_id = b.id
    AND hp.host_id = p_host_id
    AND hp.status = 'scheduled'
    AND b.checked_in_at IS NOT NULL
    AND b.arrival_issue_status IS DISTINCT FROM 'open';

  -- Only schedule payouts for confirmed or completed bookings without an open arrival issue
  FOR v_booking IN
    SELECT
      b.id AS booking_id,
      b.check_out,
      b.checked_in_at,
      q.host_id,
      q.host_payout_amount,
      q.currency
    FROM public.bookings b
    JOIN public.booking_quotes q ON q.id = b.quote_id
    WHERE q.host_id = p_host_id
      AND b.status IN ('confirmed', 'completed')
      AND b.arrival_issue_status IS DISTINCT FROM 'open'
      AND q.host_payout_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.host_payouts hp
        WHERE hp.booking_id = b.id AND hp.status IN ('scheduled', 'on_hold', 'processing', 'success')
      )
  LOOP
    IF v_booking.checked_in_at IS NOT NULL THEN
      v_scheduled_for := greatest(now(), v_booking.checked_in_at + interval '24 hours');
    ELSE
      v_scheduled_for := greatest(now(), v_booking.check_out + interval '24 hours');
    END IF;

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
      v_scheduled_for,
      'scheduled'
    )
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_pending_host_payouts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_pending_host_payouts(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. RPC: host_check_in_booking(p_booking_id uuid, p_pin text)
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

  IF v_booking.check_in IS NOT NULL
     AND timezone('Africa/Nairobi', now()) < (timezone('Africa/Nairobi', v_booking.check_in)::date + time '06:00') THEN
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
      INSERT INTO public.notifications (
        user_id, type, title, message, action_type, action_id, metadata
      ) VALUES (
        v_booking.user_id,
        'booking_checked_in',
        'Check-In Verified! 🎉',
        'Your host has verified your arrival for "' || COALESCE(v_booking.trip_title, 'your booking') || '". Enjoy your experience!',
        'booking',
        v_booking.id,
        jsonb_build_object('booking_id', v_booking.id, 'method', 'pin_verified')
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.host_check_in_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_check_in_booking(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. RPC: guest_check_in_booking(p_booking_id uuid, p_latitude, p_longitude, p_distance_meters)
-- -----------------------------------------------------------------------------
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

  IF v_booking.check_in IS NOT NULL
     AND timezone('Africa/Nairobi', now()) < (timezone('Africa/Nairobi', v_booking.check_in)::date + time '06:00') THEN
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
      INSERT INTO public.notifications (
        user_id, type, title, message, action_type, action_id, metadata
      ) VALUES (
        v_host_id,
        'booking_checked_in',
        'Guest Checked In! 🎉',
        'Your guest has checked in to "' || COALESCE(v_booking.trip_title, 'your property') || '". Your payout is scheduled for release in 24 hours.',
        'booking',
        v_booking.id,
        jsonb_build_object(
          'booking_id', v_booking.id,
          'method', 'guest_self_checkin',
          'gps_verified', v_gps_verified
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_check_in_booking(uuid, double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guest_check_in_booking(uuid, double precision, double precision, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. RPC: report_booking_arrival_issue(p_booking_id uuid, p_reason text)
-- -----------------------------------------------------------------------------
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
      INSERT INTO public.notifications (
        user_id, type, title, message, action_type, action_id, metadata
      ) VALUES (
        v_host_id,
        'arrival_issue_reported',
        'Arrival Issue Reported — Payout Paused',
        'The guest reported an arrival issue for "' || COALESCE(v_booking.trip_title, 'your booking') || '": ' || v_reason || '. Host payout is paused pending review.',
        'booking',
        v_booking.id,
        jsonb_build_object('booking_id', v_booking.id, 'reason', v_reason)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.report_booking_arrival_issue(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_booking_arrival_issue(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. Guard guest_cancel_booking so checked-in bookings cannot be self-cancelled
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
      failure_reason = COALESCE(p_reason, 'Guest cancelled reservation')
  WHERE booking_id = v_booking.id AND status IN ('scheduled', 'on_hold');

  -- If booking was paid or confirmed, create refund request & balance the ledger
  IF v_booking.status IN ('paid', 'confirmed') AND v_booking.quote_id IS NOT NULL THEN
    v_target_status := 'refund_pending';

    SELECT bq.* INTO v_quote
    FROM public.booking_quotes bq
    WHERE bq.id = v_booking.quote_id;

    IF FOUND THEN
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
        v_quote.total_amount,
        v_quote.currency,
        COALESCE(p_reason, 'Guest requested cancellation'),
        'pending'
      ) ON CONFLICT DO NOTHING;

      INSERT INTO public.financial_ledger (
        booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
      ) VALUES (
        v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
        'HOST_ESCROW_PAYABLE', 'PLATFORM_CASH', v_quote.host_payout_amount, v_quote.currency,
        jsonb_build_object('cancellation_by', 'guest', 'reason', p_reason)
      );

      IF v_quote.host_service_fee_amount > 0 THEN
        INSERT INTO public.financial_ledger (
          booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
        ) VALUES (
          v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
          'PLATFORM_SERVICE_FEE_REVENUE', 'PLATFORM_CASH', v_quote.host_service_fee_amount, v_quote.currency,
          jsonb_build_object('cancellation_by', 'guest', 'fee_reversal', true)
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.booking_lifecycle_events (booking_id, from_status, to_status, actor_id, actor_type, reason)
  VALUES (v_booking.id, v_booking.status, v_target_status, v_user_id, 'guest', p_reason);

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

  -- Notify host
  SELECT e.user_id INTO v_host_id
  FROM public.experiences e
  WHERE e.id = v_booking.experience_id;

  IF v_host_id IS NOT NULL THEN
    BEGIN
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
        'booking_cancelled',
        'Reservation Cancelled',
        COALESCE('Reservation for "' || v_booking.trip_title || '" was cancelled by the guest.', 'Reservation cancelled'),
        'booking',
        v_booking.id,
        jsonb_build_object('booking_id', v_booking.id, 'reason', p_reason)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_cancel_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guest_cancel_booking(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
