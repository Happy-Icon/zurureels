-- Migration: 202608130003_fix_host_booking_accept_is_booking_host.sql
-- Fixes Host Booking Accept error: "column b.metadata does not exist"

-- =============================================================================
-- 1. HARDENED is_booking_host RPC (Canonical Host Relationship, No b.metadata)
-- =============================================================================
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
          WHERE e2.id = b.experience_id
            AND e2.user_id = p_host_id
        )
      )
  ) INTO v_is_host;

  RETURN COALESCE(v_is_host, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_booking_host(uuid, uuid) TO authenticated;

-- =============================================================================
-- 2. IDEMPOTENT host_confirm_booking RPC (Atomic FOR UPDATE, Quote Sync, Notification)
-- =============================================================================
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

  -- Atomic row lock
  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING errcode = 'P0002';
  END IF;

  -- Check host authorization using canonical experience/quote relationships
  v_is_auth := public.is_booking_host(p_booking_id, v_host_id);

  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'You are not authorized to manage this booking' USING errcode = '42501';
  END IF;

  -- Idempotency check: if already confirmed, return without re-processing
  IF v_booking.status = 'confirmed' THEN
    RETURN v_booking;
  END IF;

  IF v_booking.status NOT IN ('paid', 'pending') THEN
    RAISE EXCEPTION 'Booking status (%) cannot be confirmed', v_booking.status USING errcode = 'P0001';
  END IF;

  -- Update booking status to confirmed
  UPDATE public.bookings
  SET status = 'confirmed',
      updated_at = now()
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  -- Synchronize quote status if quote_id exists
  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'confirmed',
        updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  -- Create in-app notification for guest (text-only, zero image_url column reference)
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
        jsonb_build_object('booking_id', v_booking.id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.host_confirm_booking(uuid) TO authenticated;

-- =============================================================================
-- 3. IDEMPOTENT host_decline_booking & host_cancel_booking RPCs
-- =============================================================================
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
        jsonb_build_object('booking_id', v_booking.id, 'reason', p_reason)
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

GRANT EXECUTE ON FUNCTION public.host_decline_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_cancel_booking(uuid, text) TO authenticated;
