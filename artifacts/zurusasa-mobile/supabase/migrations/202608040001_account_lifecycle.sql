-- ============================================================================
-- Migration: Account Lifecycle (Deactivation + Deletion Eligibility)
-- File: 202608040001_account_lifecycle.sql
--
-- Adds marketplace-safe account lifecycle:
--   active → deactivated → (eligible?) → deleted
--
-- Does NOT replace the existing GDPR deletion RPC/Edge Function — this is
-- the safety layer that sits in front of it.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Account Status Column
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

-- Drop then add CHECK to handle idempotent re-runs
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'deactivated', 'pending_deletion', 'deleted'));

-- Index for filtering deactivated accounts from public queries
CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles (account_status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Deactivate Account RPC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.deactivate_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_user_id UUID;
  v_current_status  TEXT;
BEGIN
  v_calling_user_id := auth.uid();

  IF v_calling_user_id IS NULL OR v_calling_user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only deactivate your own account.';
  END IF;

  SELECT account_status INTO v_current_status
    FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_current_status = 'deactivated' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Account is already deactivated.',
      'account_status', 'deactivated'
    );
  END IF;

  IF v_current_status != 'active' THEN
    RAISE EXCEPTION 'Account cannot be deactivated from status: %', v_current_status;
  END IF;

  -- Set account status
  UPDATE public.profiles
    SET account_status = 'deactivated',
        updated_at = now()
    WHERE id = p_user_id;

  -- Hide all host listings from search (preserve data)
  UPDATE public.experiences
    SET availability_status = 'unlisted',
        updated_at = now()
    WHERE user_id = p_user_id
      AND availability_status = 'available';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your account has been deactivated. You can reactivate at any time.',
    'account_status', 'deactivated'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_account(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_account(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Reactivate Account RPC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reactivate_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_user_id UUID;
  v_current_status  TEXT;
  v_restored_count  INTEGER;
BEGIN
  v_calling_user_id := auth.uid();

  IF v_calling_user_id IS NULL OR v_calling_user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only reactivate your own account.';
  END IF;

  SELECT account_status INTO v_current_status
    FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_current_status = 'active' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Account is already active.',
      'account_status', 'active'
    );
  END IF;

  IF v_current_status != 'deactivated' THEN
    RAISE EXCEPTION 'Account cannot be reactivated from status: %', v_current_status;
  END IF;

  -- Restore account
  UPDATE public.profiles
    SET account_status = 'active',
        updated_at = now()
    WHERE id = p_user_id;

  -- Restore listings
  UPDATE public.experiences
    SET availability_status = 'available',
        updated_at = now()
    WHERE user_id = p_user_id
      AND availability_status = 'unlisted';

  GET DIAGNOSTICS v_restored_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your account has been reactivated.',
    'account_status', 'active',
    'listings_restored', v_restored_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_account(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_account(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Check Deletion Eligibility RPC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_deletion_eligibility(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_user_id UUID;
  v_blockers         JSONB := '[]'::JSONB;
  v_count            INTEGER;
  v_amount           BIGINT;
BEGIN
  v_calling_user_id := auth.uid();

  IF v_calling_user_id IS NULL OR v_calling_user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only check your own account.';
  END IF;

  -- ── Guest Blockers ───────────────────────────────────────────────────────

  -- Upcoming reservations (as guest)
  SELECT count(*) INTO v_count
    FROM public.bookings
    WHERE user_id = p_user_id
      AND status IN ('paid', 'confirmed', 'pending')
      AND check_in > now();

  IF v_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'type', 'upcoming_reservations',
      'count', v_count,
      'message', format('You have %s upcoming reservation(s).', v_count),
      'action', 'view_bookings'
    ));
  END IF;

  -- Active stays (as guest — currently checked in)
  SELECT count(*) INTO v_count
    FROM public.bookings
    WHERE user_id = p_user_id
      AND status = 'confirmed'
      AND check_in <= now()
      AND check_out > now();

  IF v_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'type', 'active_stays',
      'count', v_count,
      'message', format('You have %s active stay(s) in progress.', v_count),
      'action', 'view_bookings'
    ));
  END IF;

  -- Pending payment attempts (as guest)
  SELECT count(*) INTO v_count
    FROM public.payment_attempts
    WHERE guest_id = p_user_id
      AND status IN ('created', 'pending');

  IF v_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'type', 'pending_payments',
      'count', v_count,
      'message', format('You have %s pending payment(s).', v_count),
      'action', 'view_bookings'
    ));
  END IF;

  -- ── Host Blockers ────────────────────────────────────────────────────────

  -- Upcoming bookings (as host)
  SELECT count(*) INTO v_count
    FROM public.bookings b
    JOIN public.booking_quotes bq ON b.quote_id = bq.id
    WHERE bq.host_id = p_user_id
      AND b.status IN ('paid', 'confirmed', 'pending')
      AND b.check_in > now();

  IF v_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'type', 'upcoming_host_bookings',
      'count', v_count,
      'message', format('You have %s upcoming guest booking(s) as a host.', v_count),
      'action', 'view_host_bookings'
    ));
  END IF;

  -- Guests currently checked in (as host)
  SELECT count(*) INTO v_count
    FROM public.bookings b
    JOIN public.booking_quotes bq ON b.quote_id = bq.id
    WHERE bq.host_id = p_user_id
      AND b.status = 'confirmed'
      AND b.check_in <= now()
      AND b.check_out > now();

  IF v_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'type', 'active_guest_stays',
      'count', v_count,
      'message', format('You have %s guest(s) currently checked in.', v_count),
      'action', 'view_host_bookings'
    ));
  END IF;

  -- Pending payouts (as host)
  SELECT count(*), coalesce(sum(amount), 0)
    INTO v_count, v_amount
    FROM public.host_payouts
    WHERE host_id = p_user_id
      AND status IN ('scheduled', 'processing');

  IF v_count > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'type', 'pending_payouts',
      'count', v_count,
      'amount', v_amount,
      'message', format('You have %s pending payout(s) totalling KES %s.', v_count, round(v_amount / 100.0, 2)),
      'action', 'view_wallet'
    ));
  END IF;

  -- ── Future-proof: Disputes / Refunds ─────────────────────────────────────
  -- These tables don't exist yet. When added, uncomment and they activate.
  --
  -- SELECT count(*) INTO v_count
  --   FROM public.disputes
  --   WHERE (claimant_id = p_user_id OR respondent_id = p_user_id)
  --     AND status IN ('open', 'under_review');
  -- IF v_count > 0 THEN ...
  --
  -- SELECT count(*) INTO v_count
  --   FROM public.refunds
  --   WHERE user_id = p_user_id AND status = 'processing';
  -- IF v_count > 0 THEN ...

  RETURN jsonb_build_object(
    'can_delete', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_deletion_eligibility(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_deletion_eligibility(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Preserve Reviews: SET NULL on reviewer_id
-- ═══════════════════════════════════════════════════════════════════════════
-- When a reviewer deletes their account, the review stays with author
-- shown as "Deleted User". The host_id FK remains CASCADE (if the host
-- profile is deleted, reviews on that host have no display context).

ALTER TABLE public.host_reviews
  DROP CONSTRAINT IF EXISTS host_reviews_reviewer_id_fkey;

ALTER TABLE public.host_reviews
  ALTER COLUMN reviewer_id DROP NOT NULL;

ALTER TABLE public.host_reviews
  ADD CONSTRAINT host_reviews_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Hide Deactivated Hosts' Listings from Public Search
-- ═══════════════════════════════════════════════════════════════════════════
-- Supplemental policy: only show experiences from active accounts (or
-- de-identified retained listings where user_id is NULL).

DROP POLICY IF EXISTS "Hide deactivated host listings" ON public.experiences;
CREATE POLICY "Hide deactivated host listings" ON public.experiences
  FOR SELECT
  USING (
    -- Owner is active
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = experiences.user_id
        AND p.account_status = 'active'
    )
    -- OR de-identified retained listing (user deleted, but listing kept for counterparty)
    OR user_id IS NULL
    -- OR the caller owns this listing (so deactivated users can still see their own)
    OR user_id = auth.uid()
  );
