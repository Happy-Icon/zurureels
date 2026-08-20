-- =============================================================================
-- Migration: 202608200002_add_is_verified_column.sql
-- Description: Add is_verified boolean column to public.profiles
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Update is_verified to true for profiles already having verified status
UPDATE public.profiles
SET is_verified = true
WHERE lower(trim(COALESCE(verification_status, ''))) IN ('verified', 'approved');

CREATE INDEX IF NOT EXISTS idx_profiles_is_verified
  ON public.profiles (is_verified);
