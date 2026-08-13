-- Migration: 202608130001_phase1_performance_indexes.sql
-- Phase 1 Performance Optimization: Indexes + Batched Reel Interactions RPC

-- =============================================================================
-- 1. HIGH-IMPACT DATABASE INDEXES
-- =============================================================================

-- Experiences Table Indexes
CREATE INDEX IF NOT EXISTS idx_experiences_user_id
  ON public.experiences (user_id);

CREATE INDEX IF NOT EXISTS idx_experiences_category
  ON public.experiences (category);

-- Reels Table Indexes
CREATE INDEX IF NOT EXISTS idx_reels_status_created
  ON public.reels (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reels_user_id
  ON public.reels (user_id);

-- Bookings Table Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id
  ON public.bookings (user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_exp_checkin_checkout
  ON public.bookings (experience_id, check_in, check_out);

-- Messages Table Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at DESC);

-- Interaction Tables Indexes
CREATE INDEX IF NOT EXISTS idx_reel_likes_reel_id
  ON public.reel_likes (reel_id);

CREATE INDEX IF NOT EXISTS idx_reel_saves_user_reel
  ON public.reel_saves (user_id, reel_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_following
  ON public.user_follows (follower_id, following_id);

-- =============================================================================
-- 2. BATCHED REEL INTERACTIONS RPC FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_reel_interactions(
  p_reel_ids uuid[]
)
RETURNS TABLE (
  reel_id uuid,
  like_count bigint,
  liked boolean,
  saved boolean,
  following boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH requested_reels AS (
    SELECT UNNEST(p_reel_ids) AS r_id
  ),
  likes_agg AS (
    SELECT
      rl.reel_id AS r_id,
      COUNT(*)::bigint AS l_count,
      LOGICAL_OR(v_user_id IS NOT NULL AND rl.user_id = v_user_id) AS is_liked
    FROM public.reel_likes rl
    WHERE rl.reel_id = ANY(p_reel_ids)
    GROUP BY rl.reel_id
  ),
  saves_agg AS (
    SELECT
      rs.reel_id AS r_id,
      TRUE AS is_saved
    FROM public.reel_saves rs
    WHERE v_user_id IS NOT NULL AND rs.user_id = v_user_id AND rs.reel_id = ANY(p_reel_ids)
  ),
  hosts_map AS (
    SELECT DISTINCT
      r.id AS r_id,
      r.user_id AS host_id
    FROM public.reels r
    WHERE r.id = ANY(p_reel_ids) AND r.user_id IS NOT NULL
  ),
  follows_agg AS (
    SELECT
      hm.r_id,
      TRUE AS is_following
    FROM hosts_map hm
    JOIN public.user_follows uf ON uf.follower_id = v_user_id AND uf.following_id = hm.host_id
    WHERE v_user_id IS NOT NULL
  )
  SELECT
    req.r_id AS reel_id,
    COALESCE(la.l_count, 0::bigint) AS like_count,
    COALESCE(la.is_liked, FALSE) AS liked,
    COALESCE(sa.is_saved, FALSE) AS saved,
    COALESCE(fa.is_following, FALSE) AS following
  FROM requested_reels req
  LEFT JOIN likes_agg la ON la.r_id = req.r_id
  LEFT JOIN saves_agg sa ON sa.r_id = req.r_id
  LEFT JOIN follows_agg fa ON fa.r_id = req.r_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reel_interactions(uuid[]) TO anon, authenticated;
