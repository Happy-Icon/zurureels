-- ============================================================================
-- Migration: GDPR Compliant Account & Data Deletion RPC (rewritten)
-- File: supabase/migrations/202608030001_gdpr_account_deletion_rpc.sql
--
-- Security-definer RPC that hard-deletes the calling user's own rows.
-- Does NOT touch auth.users — that is the Edge Function's job via
-- auth.admin.deleteUser(). Financial rows belonging to *other* users are
-- left in place; the SET NULL FKs (202608030002) sever the link when the
-- auth.users row is finally removed.
--
-- Tables that CASCADE from auth.users (conversations, messages,
-- notifications, user_devices) need no explicit DELETE here.
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_user_account(UUID);

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_user_id UUID;
BEGIN
  v_calling_user_id := auth.uid();

  -- Self-service guard: only the authenticated owner may call this.
  IF v_calling_user_id IS NULL OR v_calling_user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
  END IF;

  -- ── 1. Social / interaction rows ─────────────────────────────────────────
  DELETE FROM public.reel_likes  WHERE user_id = p_user_id;
  DELETE FROM public.reel_saves  WHERE user_id = p_user_id;
  DELETE FROM public.reel_views  WHERE viewer_id = p_user_id;
  DELETE FROM public.reel_shares WHERE sharer_id = p_user_id;

  DELETE FROM public.user_follows
    WHERE follower_id = p_user_id OR following_id = p_user_id;

  DELETE FROM public.host_profile_views WHERE viewer_id = p_user_id;

  -- ── 2. Events / subscriptions ────────────────────────────────────────────
  DELETE FROM public.event_subscribers WHERE user_id = p_user_id;

  -- ── 3. Host PII: payout bank details (own data, no counterparty) ─────────
  DELETE FROM public.host_payout_recipients WHERE host_id = p_user_id;

  -- ── 4. Unbooked experiences: safe to hard-delete ─────────────────────────
  -- Booked experiences are protected by booking_quotes.experience_id RESTRICT;
  -- they survive and get de-identified when auth.users is deleted (SET NULL).
  DELETE FROM public.experiences
    WHERE user_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_quotes q
        WHERE q.experience_id = experiences.id
      );

  -- ── 5. Profile (cascades reels, event_subscribers via profile FK,
  --        host_profile_views.host_id) ──────────────────────────────────────
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- ── Done: auth.users deletion + storage cleanup happen in the Edge Function.
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id
  );
END;
$$;

-- Only authenticated users may invoke.
REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;
