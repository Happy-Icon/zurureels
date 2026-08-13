-- Migration: 202608130002_phase4_booking_flow_reliability.sql
-- Phase 4: Booking Flow Reliability & Idempotent State Transitions

-- 1. Hardened is_booking_host RPC Function (Prevents text/UUID cast errors)
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
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.booking_quotes bq ON b.quote_id = bq.id
    LEFT JOIN public.experiences e ON b.experience_id = e.id
    WHERE b.id = p_booking_id
      AND (
        bq.host_id = p_host_id
        OR e.user_id = p_host_id
        OR b.metadata->>'host_id' = p_host_id::text
      )
  ) INTO v_is_host;

  RETURN COALESCE(v_is_host, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_booking_host(uuid, uuid) TO authenticated;

-- 2. Idempotent host_confirm_booking RPC with In-App Notification and Quote Status Sync
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

  v_is_auth := public.is_booking_host(p_booking_id, v_host_id);

  IF NOT v_is_auth THEN
    RAISE EXCEPTION 'You are not authorized to manage this booking' USING errcode = '42501';
  END IF;

  -- Idempotency check: if already confirmed, return without error
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

  -- Update associated quote status if present
  IF v_booking.quote_id IS NOT NULL THEN
    UPDATE public.booking_quotes
    SET status = 'confirmed',
        updated_at = now()
    WHERE id = v_booking.quote_id;
  END IF;

  -- Insert in-app notification for guest
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
