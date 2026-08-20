-- =============================================================================
-- Migration: 202608200003_reset_verification_statuses.sql
-- Description: Reset test verification statuses to unverified for clean testing
-- =============================================================================

UPDATE public.profiles
SET
  verification_status = 'unverified',
  identity_verification_status = 'unverified',
  is_verified = false,
  persona_inquiry_id = null,
  verified_at = null,
  verification_details = '{}'::jsonb;
