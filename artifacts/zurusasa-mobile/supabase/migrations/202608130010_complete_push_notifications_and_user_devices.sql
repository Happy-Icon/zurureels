-- Migration: 202608130010_complete_push_notifications_and_user_devices.sql
-- Consolidated, idempotent schema for user_devices, notifications, RLS, and RPCs.

-- =============================================================================
-- 1. CANONICAL user_devices TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token text NOT NULL,
  device_type text DEFAULT 'android',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure all columns exist idempotently
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'android',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure unique constraint on (user_id, push_token)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_devices'::regclass
      AND (conname = 'user_devices_user_push_token_key' OR conname = 'user_devices_user_token_unique')
  ) THEN
    ALTER TABLE public.user_devices
      ADD CONSTRAINT user_devices_user_push_token_key UNIQUE (user_id, push_token);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Performance indexes for push token lookups
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_push_token ON public.user_devices (push_token);
CREATE INDEX IF NOT EXISTS idx_user_devices_active_user ON public.user_devices (user_id, is_active);

-- Enable RLS on user_devices
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own devices" ON public.user_devices;
CREATE POLICY "Users can manage their own devices"
  ON public.user_devices
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT ALL ON public.user_devices TO authenticated;
GRANT SELECT ON public.user_devices TO anon;

-- Security Definer RPC for Device Push Token Registration
CREATE OR REPLACE FUNCTION public.register_device_push_token(
  p_push_token text,
  p_device_type text DEFAULT 'android'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_push_token IS NULL OR length(trim(p_push_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'push_token is required');
  END IF;

  -- 1. Try upsert via unique constraint
  BEGIN
    INSERT INTO public.user_devices (user_id, push_token, device_type, is_active, updated_at)
    VALUES (v_user_id, p_push_token, COALESCE(p_device_type, 'android'), true, now())
    ON CONFLICT (user_id, push_token) DO UPDATE
    SET is_active = true,
        device_type = EXCLUDED.device_type,
        updated_at = now()
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('success', true, 'id', v_id);
  EXCEPTION WHEN OTHERS THEN
    -- 2. Fallback if constraint is pending or named differently
    UPDATE public.user_devices
    SET is_active = true,
        device_type = COALESCE(p_device_type, 'android'),
        updated_at = now()
    WHERE user_id = v_user_id AND push_token = p_push_token
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      INSERT INTO public.user_devices (user_id, push_token, device_type, is_active, updated_at)
      VALUES (v_user_id, p_push_token, COALESCE(p_device_type, 'android'), true, now())
      RETURNING id INTO v_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_id);
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text) TO authenticated;

-- =============================================================================
-- 2. CANONICAL notifications TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  image_url text NULL,
  data jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure all columns exist idempotently
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS image_url text NULL,
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.notifications TO authenticated;

-- Security Definer RPC for Guaranteed Cross-User In-App Notifications
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id is required');
  END IF;

  BEGIN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      metadata,
      is_read
    ) VALUES (
      p_user_id,
      COALESCE(p_type, 'notification'),
      COALESCE(p_title, 'New Notification'),
      COALESCE(p_message, ''),
      COALESCE(p_metadata, '{}'::jsonb),
      false
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('success', true, 'id', v_id);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message
      ) VALUES (
        p_user_id,
        COALESCE(p_type, 'notification'),
        COALESCE(p_title, 'New Notification'),
        COALESCE(p_message, '')
      )
      RETURNING id INTO v_id;

      RETURN jsonb_build_object('success', true, 'id', v_id);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, jsonb) TO authenticated, anon;
