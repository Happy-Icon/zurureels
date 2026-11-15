-- =============================================================================
-- Migration: 202611150003_events_end_time.sql
-- Description: Persist explicit event end_time on public.events so live phase,
--              time-range display ("From - To"), and countdowns work directly
--              from both events table queries and reel metadata.
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_time text;
