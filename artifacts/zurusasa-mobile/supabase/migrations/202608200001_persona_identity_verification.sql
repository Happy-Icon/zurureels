-- =============================================================================
-- Migration: 202608200001_persona_identity_verification.sql
-- Description: Persona Identity Verification database schema and RPCs
-- =============================================================================

-- 1. Ensure required columns exist on public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS persona_inquiry_id TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS identity_verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_details JSONB DEFAULT '{}'::jsonb;

-- 2. Drop existing conflicting constraints if any
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_verification_status,
  DROP CONSTRAINT IF EXISTS profiles_verification_status_check;

-- 3. Normalize existing verification_status data on public.profiles
UPDATE public.profiles
SET verification_status = CASE
  WHEN lower(trim(COALESCE(verification_status, ''))) IN ('verified', 'approved', 'completed') THEN 'verified'
  WHEN lower(trim(COALESCE(verification_status, ''))) IN ('pending', 'in_review', 'under_review') THEN 'pending'
  WHEN lower(trim(COALESCE(verification_status, ''))) IN ('failed', 'rejected') THEN 'failed'
  WHEN lower(trim(COALESCE(verification_status, ''))) IN ('canceled', 'cancelled') THEN 'canceled'
  WHEN lower(trim(COALESCE(verification_status, ''))) IN ('declined') THEN 'declined'
  WHEN lower(trim(COALESCE(verification_status, ''))) IN ('needs_review') THEN 'needs_review'
  WHEN lower(trim(COALESCE(verification_status, ''))) IN ('none') THEN 'none'
  ELSE 'unverified'
END;

-- 4. Re-add unified check constraint supporting both legacy and Persona statuses
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('none', 'unverified', 'pending', 'verified', 'failed', 'rejected', 'canceled', 'declined', 'needs_review'));

-- 5. Create index for fast status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON public.profiles (verification_status);

CREATE INDEX IF NOT EXISTS idx_profiles_persona_inquiry_id
  ON public.profiles (persona_inquiry_id);

-- 6. Secure RPC to submit Persona Inquiry completion from authenticated client or Edge Function
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
  v_user_id UUID;
  v_final_status TEXT;
  v_is_verified BOOLEAN := false;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_result JSONB;
BEGIN
  -- Determine user ID from auth context
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_inquiry_id IS NULL OR length(trim(p_inquiry_id)) = 0 THEN
    RAISE EXCEPTION 'Inquiry ID is required';
  END IF;

  -- Map Persona status to ZuruSasa status
  IF lower(p_status) IN ('completed', 'approved', 'verified') THEN
    v_final_status := 'verified';
    v_is_verified := true;
  ELSIF lower(p_status) IN ('declined', 'failed', 'rejected') THEN
    v_final_status := 'failed';
    v_is_verified := false;
  ELSIF lower(p_status) IN ('needs_review', 'pending') THEN
    v_final_status := 'pending';
    v_is_verified := false;
  ELSIF lower(p_status) IN ('canceled', 'cancelled') THEN
    v_final_status := 'canceled';
    v_is_verified := false;
  ELSE
    v_final_status := 'pending';
    v_is_verified := false;
  END IF;

  -- Update profiles record
  UPDATE public.profiles
  SET
    persona_inquiry_id = p_inquiry_id,
    verification_status = v_final_status,
    identity_verification_status = CASE WHEN v_is_verified THEN 'Verified' ELSE initcap(v_final_status) END,
    is_verified = CASE WHEN v_is_verified THEN true ELSE COALESCE(is_verified, false) END,
    verified_at = CASE WHEN v_is_verified THEN v_now ELSE verified_at END,
    verification_updated_at = v_now,
    verification_details = jsonb_build_object(
      'inquiry_id', p_inquiry_id,
      'status', p_status,
      'mapped_status', v_final_status,
      'fields', COALESCE(p_fields, '{}'::jsonb),
      'updated_at', v_now
    )
  WHERE id = v_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'inquiry_id', p_inquiry_id,
    'verification_status', v_final_status,
    'is_verified', v_is_verified,
    'updated_at', v_now
  );

  RETURN v_result;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_persona_inquiry_result(TEXT, TEXT, JSONB) TO authenticated;
