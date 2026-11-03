-- =============================================================================
-- Migration: 202611020001_security_privileges_kyc_and_notifications_hardening.sql
-- Description:
--   1. Lock settle_paystack_success strictly to service_role (closes payment privilege escalation)
--   2. Harden schedule_pending_host_payouts (revoke anon, enforce host/service_role check, confirmed/completed only)
--   3. Prevent client-side KYC self-verification & admin role escalation (submit_persona_inquiry_result + profiles trigger)
--   4. Harden notifications RLS/grants and send_notification domain-relationship authorization
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Harden schedule_pending_host_payouts
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

  -- Only schedule payouts for confirmed or completed bookings (never unapproved 'paid' bookings)
  FOR v_booking IN
    SELECT b.id AS booking_id, b.check_out, q.host_id, q.host_payout_amount, q.currency
    FROM public.bookings b
    JOIN public.booking_quotes q ON q.id = b.quote_id
    WHERE q.host_id = p_host_id
      AND b.status IN ('confirmed', 'completed')
      AND q.host_payout_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.host_payouts hp
        WHERE hp.booking_id = b.id AND hp.status IN ('scheduled', 'processing', 'success')
      )
  LOOP
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
      greatest(now(), v_booking.check_out + interval '24 hours'),
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
-- 2. Lock settle_paystack_success strictly to service_role
-- -----------------------------------------------------------------------------
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

  -- Double-Entry Financial Ledger
  INSERT INTO public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) VALUES (
    v_booking_id, v_quote.id, v_attempt.id, 'guest_payment', 'PAYSTACK_CLEARING', 'PLATFORM_CASH', v_quote.total_amount, v_quote.currency,
    jsonb_build_object('guest_id', v_quote.guest_id)
  ) ON CONFLICT DO NOTHING;

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

  -- Schedule host payout safely (will only schedule if instant-confirmed)
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

-- -----------------------------------------------------------------------------
-- 3. Prevent Client KYC Self-Approval & Admin Role Escalation on public.profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_is_privileged boolean := (
    v_jwt_role = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin')
  );
BEGIN
  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF lower(COALESCE(NEW.role, 'guest')) = 'admin' THEN
      RAISE EXCEPTION 'Forbidden: cannot self-assign admin role' USING errcode = '42501';
    END IF;
    NEW.is_verified := false;
    IF lower(COALESCE(NEW.verification_status, 'unverified')) IN ('verified', 'approved', 'completed') THEN
      NEW.verification_status := 'unverified';
    END IF;
    IF lower(COALESCE(NEW.identity_verification_status, 'unverified')) = 'verified' THEN
      NEW.identity_verification_status := 'unverified';
    END IF;
    NEW.verified_at := NULL;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  IF lower(COALESCE(NEW.role, '')) = 'admin' AND lower(COALESCE(OLD.role, '')) <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden: cannot escalate profile role to admin' USING errcode = '42501';
  END IF;

  IF COALESCE(NEW.is_verified, false) = true AND COALESCE(OLD.is_verified, false) = false THEN
    RAISE EXCEPTION 'Forbidden: identity verification requires server-side Persona verification' USING errcode = '42501';
  END IF;

  IF lower(COALESCE(NEW.verification_status, '')) IN ('verified', 'approved', 'completed')
     AND lower(COALESCE(OLD.verification_status, '')) NOT IN ('verified', 'approved', 'completed') THEN
    RAISE EXCEPTION 'Forbidden: verification_status cannot be self-approved by client' USING errcode = '42501';
  END IF;

  IF lower(COALESCE(NEW.identity_verification_status, '')) = 'verified'
     AND lower(COALESCE(OLD.identity_verification_status, '')) <> 'verified' THEN
    RAISE EXCEPTION 'Forbidden: identity_verification_status cannot be self-approved by client' USING errcode = '42501';
  END IF;

  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NEW.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden: verified_at timestamp can only be set by server verification' USING errcode = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- Update submit_persona_inquiry_result so non-service_role callers can never mark themselves verified
CREATE OR REPLACE FUNCTION public.submit_persona_inquiry_result(
  p_inquiry_id TEXT,
  p_status TEXT,
  p_fields JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_jwt_role TEXT := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_is_privileged BOOLEAN := (v_jwt_role = 'service_role' OR session_user IN ('postgres', 'supabase_admin'));
  v_final_status TEXT;
  v_is_verified BOOLEAN := false;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  IF p_inquiry_id IS NULL OR length(trim(p_inquiry_id)) = 0 THEN
    RAISE EXCEPTION 'Inquiry ID is required' USING errcode = '22023';
  END IF;

  IF lower(COALESCE(p_status, '')) IN ('completed', 'approved', 'verified') THEN
    IF v_is_privileged THEN
      v_final_status := 'verified';
      v_is_verified := true;
    ELSE
      -- Client-reported completion is recorded as pending until verify-persona-inquiry / persona-webhook confirms
      v_final_status := 'pending';
      v_is_verified := false;
    END IF;
  ELSIF lower(COALESCE(p_status, '')) IN ('declined', 'failed', 'rejected') THEN
    v_final_status := 'failed';
    v_is_verified := false;
  ELSIF lower(COALESCE(p_status, '')) IN ('canceled', 'cancelled') THEN
    v_final_status := 'canceled';
    v_is_verified := false;
  ELSE
    v_final_status := 'pending';
    v_is_verified := false;
  END IF;

  UPDATE public.profiles
  SET
    persona_inquiry_id = p_inquiry_id,
    verification_status = CASE
      WHEN COALESCE(is_verified, false) = true AND NOT v_is_privileged THEN verification_status
      ELSE v_final_status
    END,
    identity_verification_status = CASE
      WHEN v_is_verified THEN 'Verified'
      WHEN COALESCE(is_verified, false) = true AND NOT v_is_privileged THEN identity_verification_status
      ELSE initcap(v_final_status)
    END,
    is_verified = CASE
      WHEN v_is_verified THEN true
      ELSE COALESCE(is_verified, false)
    END,
    verified_at = CASE
      WHEN v_is_verified THEN v_now
      ELSE verified_at
    END,
    verification_updated_at = v_now,
    verification_details = jsonb_build_object(
      'inquiry_id', p_inquiry_id,
      'reported_status', p_status,
      'mapped_status', v_final_status,
      'verified_by_server', v_is_privileged,
      'fields', COALESCE(p_fields, '{}'::jsonb),
      'updated_at', v_now
    )
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'inquiry_id', p_inquiry_id,
    'verification_status', v_final_status,
    'is_verified', v_is_verified,
    'updated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_persona_inquiry_result(TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_persona_inquiry_result(TEXT, TEXT, JSONB) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Harden public.notifications RLS/Grants & public.send_notification RPC
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.notifications FROM anon;

DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
CREATE POLICY "notifications_insert_policy"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_is_privileged boolean := (v_jwt_role = 'service_role' OR session_user IN ('postgres', 'supabase_admin'));
  v_caller_id uuid := auth.uid();
  v_norm_type text := lower(trim(COALESCE(p_type, 'notification')));
  v_has_relationship boolean := false;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id is required');
  END IF;

  IF NOT v_is_privileged THEN
    IF v_caller_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Prevent clients from forging authoritative payment/payout/refund/KYC notifications
    IF v_norm_type IN ('payment_success', 'payout_completed', 'refund_processed', 'verification_approved') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden notification type');
    END IF;

    IF p_user_id <> v_caller_id THEN
      SELECT (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE (c.participant_one = v_caller_id AND c.participant_two = p_user_id)
             OR (c.participant_one = p_user_id AND c.participant_two = v_caller_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.booking_quotes bq
          WHERE (bq.guest_id = v_caller_id AND bq.host_id = p_user_id)
             OR (bq.host_id = v_caller_id AND bq.guest_id = p_user_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          JOIN public.experiences e ON e.id = b.experience_id
          WHERE (b.user_id = v_caller_id AND e.user_id = p_user_id)
             OR (e.user_id = v_caller_id AND b.user_id = p_user_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.user_follows uf
          WHERE uf.follower_id = v_caller_id AND uf.following_id = p_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.reel_likes rl
          JOIN public.reels r ON r.id = rl.reel_id
          WHERE rl.user_id = v_caller_id AND r.user_id = p_user_id
        )
      ) INTO v_has_relationship;

      IF NOT COALESCE(v_has_relationship, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: no valid relationship with recipient');
      END IF;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    data,
    is_read,
    read,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    COALESCE(p_type, 'notification'),
    COALESCE(p_title, 'New Notification'),
    COALESCE(p_message, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb),
    false,
    false,
    now(),
    now()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, jsonb) TO authenticated, service_role;
