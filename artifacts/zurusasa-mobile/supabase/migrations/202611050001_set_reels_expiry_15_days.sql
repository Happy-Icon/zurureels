-- =============================================================================
-- Migration: 202611050001_set_reels_expiry_15_days.sql
-- Description: Standardize reels expiration default to exactly 15 days across all environments.
-- =============================================================================

ALTER TABLE public.reels ALTER COLUMN expires_at SET DEFAULT (now() + interval '15 days');

-- Update active reels to ensure expires_at is aligned to exactly created_at + 15 days
UPDATE public.reels
SET expires_at = created_at + interval '15 days'
WHERE status IN ('active', 'published');
