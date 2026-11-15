-- =============================================================================
-- Migration: 202611150005_user_payment_methods.sql
-- Purpose:
--   Persist guest payment methods (M-Pesa / Hosted Card preference) and their
--   single DEFAULT payment method per user so BookingSheet automatically checks
--   and applies the user's saved default without forcing re-entry every time,
--   while allowing users to add, switch default, or remove saved methods.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type text NOT NULL CHECK (method_type IN ('mpesa', 'card')),
  label text NOT NULL,
  phone_number text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_payment_methods_mpesa_phone_chk CHECK (
    method_type <> 'mpesa' OR (phone_number IS NOT NULL AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) >= 9)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_payment_methods_single_default_idx
  ON public.user_payment_methods (user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS user_payment_methods_user_idx
  ON public.user_payment_methods (user_id, is_default DESC, created_at DESC);

ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payment methods" ON public.user_payment_methods;
CREATE POLICY "Users can view their own payment methods"
  ON public.user_payment_methods FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own payment methods" ON public.user_payment_methods;
CREATE POLICY "Users can insert their own payment methods"
  ON public.user_payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own payment methods" ON public.user_payment_methods;
CREATE POLICY "Users can update their own payment methods"
  ON public.user_payment_methods FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own payment methods" ON public.user_payment_methods;
CREATE POLICY "Users can delete their own payment methods"
  ON public.user_payment_methods FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upsert_user_payment_method(
  p_method_type text,
  p_label text DEFAULT NULL,
  p_phone_number text DEFAULT NULL,
  p_set_default boolean DEFAULT true
)
RETURNS public.user_payment_methods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_type text := lower(trim(COALESCE(p_method_type, '')));
  v_clean_phone text := nullif(trim(COALESCE(p_phone_number, '')), '');
  v_phone_digits text;
  v_resolved_label text;
  v_has_default boolean;
  v_should_default boolean;
  v_existing public.user_payment_methods%ROWTYPE;
  v_result public.user_payment_methods%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  IF v_clean_type NOT IN ('mpesa', 'card') THEN
    RAISE EXCEPTION 'Unsupported payment method type' USING errcode = '22023';
  END IF;

  IF v_clean_type = 'mpesa' THEN
    v_phone_digits := regexp_replace(COALESCE(v_clean_phone, ''), '[^0-9]', '', 'g');
    IF length(v_phone_digits) < 9 THEN
      RAISE EXCEPTION 'Please enter a valid M-Pesa phone number' USING errcode = '22023';
    END IF;
    -- Normalize leading 07/01 or 7/1 into +254 format for display & dedupe
    IF v_phone_digits ~ '^0[17][0-9]{8}$' THEN
      v_phone_digits := '254' || substr(v_phone_digits, 2);
    ELSIF v_phone_digits ~ '^[17][0-9]{8}$' THEN
      v_phone_digits := '254' || v_phone_digits;
    END IF;
    v_clean_phone := '+' || v_phone_digits;
    v_resolved_label := COALESCE(nullif(trim(p_label), ''), 'Safaricom M-Pesa');
  ELSE
    v_clean_phone := NULL;
    v_resolved_label := COALESCE(nullif(trim(p_label), ''), 'Visa / Mastercard');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_payment_methods
    WHERE user_id = v_user_id AND is_default = true
  ) INTO v_has_default;

  v_should_default := COALESCE(p_set_default, true) OR NOT v_has_default;

  IF v_clean_type = 'card' THEN
    SELECT * INTO v_existing
    FROM public.user_payment_methods
    WHERE user_id = v_user_id AND method_type = 'card'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO v_existing
    FROM public.user_payment_methods
    WHERE user_id = v_user_id
      AND method_type = 'mpesa'
      AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = v_phone_digits
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_should_default THEN
    UPDATE public.user_payment_methods
    SET is_default = false,
        updated_at = now()
    WHERE user_id = v_user_id
      AND is_default = true
      AND (v_existing.id IS NULL OR id <> v_existing.id);
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.user_payment_methods
    SET label = v_resolved_label,
        phone_number = COALESCE(v_clean_phone, phone_number),
        is_default = CASE WHEN v_should_default THEN true ELSE is_default END,
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.user_payment_methods (
      user_id, method_type, label, phone_number, is_default
    ) VALUES (
      v_user_id, v_clean_type, v_resolved_label, v_clean_phone, v_should_default
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_user_payment_method(p_method_id uuid)
RETURNS public.user_payment_methods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target public.user_payment_methods%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_target
  FROM public.user_payment_methods
  WHERE id = p_method_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment method not found' USING errcode = 'P0002';
  END IF;

  UPDATE public.user_payment_methods
  SET is_default = false,
      updated_at = now()
  WHERE user_id = v_user_id AND is_default = true AND id <> p_method_id;

  UPDATE public.user_payment_methods
  SET is_default = true,
      updated_at = now()
  WHERE id = p_method_id AND user_id = v_user_id
  RETURNING * INTO v_target;

  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_payment_method(p_method_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted public.user_payment_methods%ROWTYPE;
  v_next_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;

  DELETE FROM public.user_payment_methods
  WHERE id = p_method_id AND user_id = v_user_id
  RETURNING * INTO v_deleted;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_deleted.is_default THEN
    SELECT id INTO v_next_id
    FROM public.user_payment_methods
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_next_id IS NOT NULL THEN
      UPDATE public.user_payment_methods
      SET is_default = true,
          updated_at = now()
      WHERE id = v_next_id AND user_id = v_user_id;
    END IF;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_payment_method(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_user_payment_method(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_payment_method(uuid) TO authenticated;
