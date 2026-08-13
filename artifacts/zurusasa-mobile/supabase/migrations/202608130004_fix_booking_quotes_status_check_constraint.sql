-- Migration: 202608130004_fix_booking_quotes_status_check_constraint.sql
-- Fixes: "23514: booking_quotes_status_check new row for relation booking_quotes violates check constraint"
-- Updates booking_quotes.status CHECK constraint to allow 'confirmed' state and updates GIST exclusion constraint.

-- =============================================================================
-- 1. UPDATE booking_quotes_status_check CONSTRAINT
-- =============================================================================
ALTER TABLE public.booking_quotes
  DROP CONSTRAINT IF EXISTS booking_quotes_status_check;

ALTER TABLE public.booking_quotes
  ADD CONSTRAINT booking_quotes_status_check
  CHECK (status IN ('quote_locked', 'payment_pending', 'payment_succeeded', 'confirmed', 'expired', 'cancelled', 'consumed'));

-- =============================================================================
-- 2. UPDATE GIST ACTIVE DATES EXCLUSION CONSTRAINT
-- =============================================================================
-- Confirmed quotes retain active date exclusion to prevent double bookings.
ALTER TABLE public.booking_quotes
  DROP CONSTRAINT IF EXISTS booking_quotes_active_dates_excl;

ALTER TABLE public.booking_quotes
  ADD CONSTRAINT booking_quotes_active_dates_excl
  EXCLUDE USING gist (
    experience_id WITH =,
    tstzrange(check_in, check_out, '[)') WITH &&
  ) WHERE (status IN ('quote_locked', 'payment_pending', 'payment_succeeded', 'confirmed'));

-- =============================================================================
-- 3. HARDENED host_confirm_booking WITH QUOTE STATUS SYNC AND IDEMPOTENCY
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

  -- Synchronize associated quote status to 'confirmed' if quote_id exists
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
