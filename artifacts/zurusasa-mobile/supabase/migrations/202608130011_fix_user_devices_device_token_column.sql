-- Migration: 202608130011_fix_user_devices_device_token_column.sql
-- Fixes: "null value in column 'device_token' of relation 'user_devices' violates not-null constraint"

-- 1. Drop NOT NULL on legacy device_token and ensure both columns exist
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS device_token text,
  ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'android',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_devices
  ALTER COLUMN device_token DROP NOT NULL;

-- 2. Sync existing rows
UPDATE public.user_devices
SET device_token = COALESCE(device_token, push_token),
    push_token = COALESCE(push_token, device_token);

-- 3. Ensure unique constraint on (user_id, push_token)
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

-- 4. Re-create register_device_push_token RPC to set BOTH push_token AND device_token
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

  BEGIN
    INSERT INTO public.user_devices (
      user_id,
      push_token,
      device_token,
      device_type,
      is_active,
      updated_at
    )
    VALUES (
      v_user_id,
      p_push_token,
      p_push_token,
      COALESCE(p_device_type, 'android'),
      true,
      now()
    )
    ON CONFLICT (user_id, push_token) DO UPDATE
    SET is_active = true,
        device_token = EXCLUDED.push_token,
        device_type = EXCLUDED.device_type,
        updated_at = now()
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('success', true, 'id', v_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.user_devices
    SET is_active = true,
        device_token = p_push_token,
        push_token = p_push_token,
        device_type = COALESCE(p_device_type, 'android'),
        updated_at = now()
    WHERE user_id = v_user_id AND (push_token = p_push_token OR device_token = p_push_token)
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      INSERT INTO public.user_devices (
        user_id,
        push_token,
        device_token,
        device_type,
        is_active,
        updated_at
      )
      VALUES (
        v_user_id,
        p_push_token,
        p_push_token,
        COALESCE(p_device_type, 'android'),
        true,
        now()
      )
      RETURNING id INTO v_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_id);
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text) TO authenticated;
