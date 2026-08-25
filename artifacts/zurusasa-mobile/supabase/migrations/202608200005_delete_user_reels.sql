-- =============================================================================
-- Migration: 202608200005_delete_user_reels.sql
-- Description: Delete reels and related metrics for host okelloulak2004@gmail.com
-- =============================================================================

DO $$
DECLARE
  target_user_id UUID := '07150556-5c7e-4bdf-b146-4611ce8c9929'::UUID;
BEGIN
  -- 1. Unlink foreign references from bookings
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'reel_id') THEN
    UPDATE public.bookings
    SET reel_id = NULL
    WHERE reel_id IN (SELECT id FROM public.reels WHERE user_id = target_user_id);
  END IF;

  -- 2. Unlink foreign references from experiences if exists
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'experiences' AND column_name = 'reel_id') THEN
    UPDATE public.experiences
    SET reel_id = NULL
    WHERE reel_id IN (SELECT id FROM public.reels WHERE user_id = target_user_id);
  END IF;

  -- 3. Delete dependent reel likes
  DELETE FROM public.reel_likes
  WHERE reel_id IN (
    SELECT id FROM public.reels WHERE user_id = target_user_id
  );

  -- 4. Delete dependent reel views if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reel_views') THEN
    DELETE FROM public.reel_views
    WHERE reel_id IN (
      SELECT id FROM public.reels WHERE user_id = target_user_id
    );
  END IF;

  -- 5. Delete the reels
  DELETE FROM public.reels
  WHERE user_id = target_user_id;

  RAISE NOTICE 'Successfully deleted reels for user %', target_user_id;
END $$;
