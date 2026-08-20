-- =============================================================================
-- Migration: 202608200004_clean_metadata_verification_keys.sql
-- Description: Clean legacy verification fields from metadata JSONB in profiles
-- =============================================================================

UPDATE public.profiles
SET metadata = metadata - 'is_verified' - 'persona_inquiry_id' - 'verification_provider' - 'verified_at'
WHERE metadata IS NOT NULL
  AND (
    metadata ? 'is_verified'
    OR metadata ? 'persona_inquiry_id'
    OR metadata ? 'verification_provider'
    OR metadata ? 'verified_at'
  );
