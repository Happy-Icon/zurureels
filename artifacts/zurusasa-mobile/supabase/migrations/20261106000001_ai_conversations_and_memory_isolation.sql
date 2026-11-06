-- =============================================================================
-- Migration: 20261106000001_ai_conversations_and_memory_isolation.sql
-- Description:
--   Milestone 2 - Establish isolated schema for Zuru AI multi-turn conversations,
--   assistant message streaming persistence, and long-term travel memories.
--   100% physically isolated from human host-guest messaging (public.conversations).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AI CONVERSATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Travel Planning',
  destination text,
  context_summary text,
  extracted_preferences jsonb DEFAULT '{}'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance Indexes for fast session listing and retrieval
CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx 
  ON public.ai_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_conversations_user_active_idx 
  ON public.ai_conversations(user_id, is_archived, updated_at DESC);

-- Automatic updated_at trigger
DROP TRIGGER IF EXISTS ai_conversations_touch_updated_at ON public.ai_conversations;
CREATE TRIGGER ai_conversations_touch_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_marketplace_updated_at();

-- -----------------------------------------------------------------------------
-- 2. AI MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  cards jsonb DEFAULT '[]'::jsonb,
  follow_ups text[] DEFAULT '{}'::text[],
  tool_calls jsonb,
  tool_results jsonb,
  execution_metadata jsonb DEFAULT '{}'::jsonb,
  client_message_id uuid, -- Idempotency key for deduplication on network retries
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance Indexes for chronological rendering and idempotency deduplication
CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx 
  ON public.ai_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ai_messages_client_id_idx 
  ON public.ai_messages(client_message_id);

-- Trigger: Touch parent conversation updated_at when a new message is inserted
CREATE OR REPLACE FUNCTION public.touch_ai_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_messages_touch_conversation_trigger ON public.ai_messages;
CREATE TRIGGER ai_messages_touch_conversation_trigger
  AFTER INSERT ON public.ai_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_ai_conversation_on_message();

-- -----------------------------------------------------------------------------
-- 3. AI USER MEMORIES TABLE (Persistent User-Approved Preferences)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('dietary', 'accessibility', 'pace', 'budget', 'interests', 'exclusions')),
  preference_key text NOT NULL,
  preference_value jsonb NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.0,
  user_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_user_memories_user_category_key UNIQUE (user_id, category, preference_key)
);

CREATE INDEX IF NOT EXISTS ai_user_memories_user_idx 
  ON public.ai_user_memories(user_id, category);

DROP TRIGGER IF EXISTS ai_user_memories_touch_updated_at ON public.ai_user_memories;
CREATE TRIGGER ai_user_memories_touch_updated_at
  BEFORE UPDATE ON public.ai_user_memories
  FOR EACH ROW EXECUTE FUNCTION public.touch_marketplace_updated_at();

-- -----------------------------------------------------------------------------
-- 4. TABLE-LEVEL PRIVILEGE GRANTS (PREVENTS 42501 PERMISSION ERRORS)
-- -----------------------------------------------------------------------------
-- Revoke all public/anon access: unauthenticated guest sessions NEVER touch DB
REVOKE ALL ON public.ai_conversations FROM PUBLIC, anon;
REVOKE ALL ON public.ai_messages FROM PUBLIC, anon;
REVOKE ALL ON public.ai_user_memories FROM PUBLIC, anon;

-- Grant standard DML to authenticated travelers (filtered by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_user_memories TO authenticated;

-- Grant unrestricted access to service_role (used by Edge Functions / Admin RPCs)
GRANT ALL ON public.ai_conversations TO service_role;
GRANT ALL ON public.ai_messages TO service_role;
GRANT ALL ON public.ai_user_memories TO service_role;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_memories ENABLE ROW LEVEL SECURITY;

-- ── 5.1 AI Conversations Policies ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users select own AI conversations" ON public.ai_conversations;
CREATE POLICY "Authenticated users select own AI conversations"
  ON public.ai_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users insert own AI conversations" ON public.ai_conversations;
CREATE POLICY "Authenticated users insert own AI conversations"
  ON public.ai_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users update own AI conversations" ON public.ai_conversations;
CREATE POLICY "Authenticated users update own AI conversations"
  ON public.ai_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users delete own AI conversations" ON public.ai_conversations;
CREATE POLICY "Authenticated users delete own AI conversations"
  ON public.ai_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 5.2 AI Messages Policies ────────────────────────────────────────────────
-- SELECT: Users can only read messages belonging to their own conversations
DROP POLICY IF EXISTS "Authenticated users view messages in own conversations" ON public.ai_messages;
CREATE POLICY "Authenticated users view messages in own conversations"
  ON public.ai_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- INSERT: Clients can ONLY insert messages where role = 'user'
-- Assistant responses MUST be inserted by the Edge Function via service_role!
DROP POLICY IF EXISTS "Authenticated users insert user role messages" ON public.ai_messages;
CREATE POLICY "Authenticated users insert user role messages"
  ON public.ai_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'user' AND
    EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- UPDATE: Users can modify/annotate messages in their own conversations
DROP POLICY IF EXISTS "Authenticated users modify messages in own conversations" ON public.ai_messages;
CREATE POLICY "Authenticated users modify messages in own conversations"
  ON public.ai_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- DELETE: Users can delete messages in their own conversations
DROP POLICY IF EXISTS "Authenticated users delete messages in own conversations" ON public.ai_messages;
CREATE POLICY "Authenticated users delete messages in own conversations"
  ON public.ai_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- ── 5.3 AI User Memories Policies ───────────────────────────────────────────
DROP POLICY IF EXISTS "Users access own AI memories" ON public.ai_user_memories;
CREATE POLICY "Users access own AI memories"
  ON public.ai_user_memories FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. GDPR ACCOUNT DELETION CASCADE INTEGRATION
-- -----------------------------------------------------------------------------
-- Replace public.delete_user_account RPC to purge AI data upon user deletion
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_user_id UUID;
  v_jwt_role text := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
BEGIN
  v_calling_user_id := auth.uid();

  -- Self-service guard: only the authenticated owner or service_role may call this.
  IF (v_calling_user_id IS NULL OR v_calling_user_id != p_user_id) AND v_jwt_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own account.';
  END IF;

  -- ── 0. Purge AI conversations and travel memories (Milestone 2 GDPR Cascade) ──
  DELETE FROM public.ai_user_memories WHERE user_id = p_user_id;
  DELETE FROM public.ai_conversations WHERE user_id = p_user_id;
  -- Note: public.ai_messages rows are automatically purged by FK ON DELETE CASCADE

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

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated, service_role;
