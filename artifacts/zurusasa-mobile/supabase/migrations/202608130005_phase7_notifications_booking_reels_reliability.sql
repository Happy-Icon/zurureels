-- Migration: 202608130005_phase7_notifications_booking_reels_reliability.sql
-- Phase 7: Fix Notifications, Booking & Reel Reliability

-- =============================================================================
-- 1. USER DEVICES TABLE & NOTIFICATIONS SCHEMA
-- =============================================================================

-- Canonical user_devices table for push notifications
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token text NOT NULL,
  device_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_devices_user_token_unique UNIQUE (user_id, push_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices (user_id);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own devices" ON public.user_devices;
CREATE POLICY "Users can manage their own devices"
  ON public.user_devices
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure notifications table has metadata & data support
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;

-- Ensure RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 2. REEL INTERACTIONS & DOUBLE-TAP IDEMPOTENCY
-- =============================================================================

-- Unique index on reel_likes to enforce exactly one like per user per reel
CREATE UNIQUE INDEX IF NOT EXISTS reel_likes_user_reel_idx
  ON public.reel_likes (user_id, reel_id);

-- PostgreSQL-compatible get_reel_interactions RPC (Replaces invalid logical_or)
CREATE OR REPLACE FUNCTION public.get_reel_interactions(
  p_reel_ids uuid[]
)
RETURNS TABLE (
  reel_id uuid,
  like_count bigint,
  liked boolean,
  saved boolean,
  following boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    r_id AS reel_id,
    COALESCE((SELECT COUNT(*)::bigint FROM public.reel_likes rl WHERE rl.reel_id = r_id), 0::bigint) AS like_count,
    CASE WHEN v_user_id IS NULL THEN FALSE
         ELSE EXISTS (SELECT 1 FROM public.reel_likes rl WHERE rl.reel_id = r_id AND rl.user_id = v_user_id)
    END AS liked,
    CASE WHEN v_user_id IS NULL THEN FALSE
         ELSE EXISTS (SELECT 1 FROM public.reel_saves rs WHERE rs.reel_id = r_id AND rs.user_id = v_user_id)
    END AS saved,
    CASE WHEN v_user_id IS NULL THEN FALSE
         ELSE EXISTS (
           SELECT 1 FROM public.user_follows uf
           JOIN public.reels r ON r.id = r_id
           WHERE uf.follower_id = v_user_id AND uf.following_id = r.user_id
         )
    END AS following
  FROM unnest(p_reel_ids) AS r_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reel_interactions(uuid[]) TO authenticated, anon;

-- =============================================================================
-- 3. BOOKING QUOTES CHECK & GIST EXCLUSION CONSTRAINTS
-- =============================================================================

ALTER TABLE public.booking_quotes
  DROP CONSTRAINT IF EXISTS booking_quotes_status_check;

ALTER TABLE public.booking_quotes
  ADD CONSTRAINT booking_quotes_status_check
  CHECK (status IN ('quote_locked', 'payment_pending', 'payment_succeeded', 'confirmed', 'expired', 'cancelled', 'consumed'));

ALTER TABLE public.booking_quotes
  DROP CONSTRAINT IF EXISTS booking_quotes_active_dates_excl;

ALTER TABLE public.booking_quotes
  ADD CONSTRAINT booking_quotes_active_dates_excl
  EXCLUDE USING gist (
    experience_id WITH =,
    tstzrange(check_in, check_out, '[)') WITH &&
  ) WHERE (status IN ('quote_locked', 'payment_pending', 'payment_succeeded', 'confirmed'));

-- =============================================================================
-- 4. HARDENED HOST & GUEST BOOKING STATE TRANSITION RPCs
-- =============================================================================

-- Canonical host verification helper
CREATE OR REPLACE FUNCTION public.is_booking_host(
  p_booking_id uuid,
  p_host_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_host boolean := false;
BEGIN
  IF p_booking_id IS NULL OR p_host_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.booking_quotes bq ON b.quote_id = bq.id
    LEFT JOIN public.experiences e ON b.experience_id = e.id
    WHERE b.id = p_booking_id
      AND (
        e.user_id = p_host_id
        OR bq.host_id = p_host_id
        OR EXISTS (
          SELECT 1 FROM public.experiences e2
          WHERE e2.id = b.experience_id AND e2.user_id = p_host_id
        )
      )
  ) INTO v_is_host;

  RETURN COALESCE(v_is_host, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_booking_host(uuid, uuid) TO authenticated;

-- Host Confirm Booking RPC
CREATE OR REPLACE FUNCTION public.host_confirm_booking(
  p_booking_id uuid
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_is_auth boolean;
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

  -- Idempotent check
  IF v_booking.status = 'confirmed' THEN
    RETURN v_booking;
  END IF;

  IF v_booking.status NOT IN ('paid', 'pending') THEN
    RAISE EXCEPTION 'Booking status (%) cannot be confirmed', v_booking.status USING errcode = 'P0001';
  END IF;

  UPDATE public.bookings
  SET status = 'confirmed',
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'confirmed',
        updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  -- Guest notification
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    BEGIN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_booking.user_id,
        'booking_confirmed',
        'Reservation Confirmed! 🎉',
        COALESCE('Your reservation for "' || v_booking.trip_title || '" was confirmed by the host.', 'Reservation confirmed'),
        jsonb_build_object('booking_id', v_booking.id, 'action_type', 'booking', 'action_id', v_booking.id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

-- Host Decline Booking RPC
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
  v_booking public.bookings%ROWTYPE;
  v_is_auth boolean;
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

  IF v_booking.status IN ('cancelled', 'declined', 'completed', 'refunded') THEN
    RETURN v_booking;
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  UPDATE public.host_payouts
  SET status = 'cancelled',
      failure_reason = COALESCE(p_reason, 'Reservation declined by host')
  WHERE booking_id = v_booking.id AND status = 'scheduled';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    BEGIN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_booking.user_id,
        'booking_declined',
        'Reservation Declined',
        COALESCE('Your reservation for "' || v_booking.trip_title || '" was declined by the host.', 'Reservation declined'),
        jsonb_build_object('booking_id', v_booking.id, 'reason', p_reason, 'action_type', 'booking', 'action_id', v_booking.id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.host_cancel_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.host_decline_booking(p_booking_id, p_reason);
END;
$$;

-- Guest Cancel Booking RPC
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
  v_booking public.bookings%ROWTYPE;
  v_host_id uuid;
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

  IF v_booking.status IN ('cancelled', 'declined', 'completed', 'refunded') THEN
    RETURN v_booking;
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  UPDATE public.host_payouts
  SET status = 'cancelled',
      failure_reason = COALESCE(p_reason, 'Guest cancelled reservation')
  WHERE booking_id = v_booking.id AND status = 'scheduled';

  -- Find host ID to send cancellation notification
  SELECT e.user_id INTO v_host_id
  FROM public.experiences e
  WHERE e.id = v_booking.experience_id;

  IF v_host_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    BEGIN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_host_id,
        'booking_cancelled',
        'Reservation Cancelled',
        COALESCE('Reservation for "' || v_booking.trip_title || '" was cancelled by the guest.', 'Reservation cancelled'),
        jsonb_build_object('booking_id', v_booking.id, 'reason', p_reason, 'action_type', 'booking', 'action_id', v_booking.id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.host_confirm_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_decline_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_cancel_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guest_cancel_booking(uuid, text) TO authenticated;
