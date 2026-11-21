-- =============================================================================
-- Migration: 202611210001_unified_notification_system_foundation.sql
-- Purpose:
--   Phase 0 & Phase 1 Foundation for ZuruSasa Unified Notification System:
--     1. Add dedupe_key (unique partial index) & priority to public.notifications
--     2. Harden public.user_devices (revoke anon, add health metadata, cross-account
--        token deactivation in register_device_push_token, scoped deactivate RPC)
--     3. Add timezone & marketing opt-in columns to public.profiles and timezone to public.experiences
--     4. Create public.notification_deliveries for independent channel tracking, retries & receipts
--     5. Create public.trip_reminders for ZuruPlan reminders
--     6. Create public.enqueue_notification_event() SQL helper (idempotent outbox)
--     7. Harden public.send_notification() privileged-type checks
--     8. Fix public.events RLS and create_booking_quote() events.end_time text->timestamptz bug
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend public.notifications with dedupe_key & priority
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND conname = 'notifications_priority_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_priority_check
      CHECK (priority IN ('critical', 'normal', 'promotional'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key
  ON public.notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- -----------------------------------------------------------------------------
-- 2. Harden public.user_devices & Device-Token Lifecycle RPCs
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;

REVOKE ALL ON public.user_devices FROM anon;

CREATE OR REPLACE FUNCTION public.register_device_push_token(
  p_push_token text,
  p_device_type text DEFAULT 'android',
  p_app_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_token text := trim(COALESCE(p_push_token, ''));
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF length(v_clean_token) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'push_token is required');
  END IF;

  -- Prevent cross-account push bleed on shared or reinstalled devices
  UPDATE public.user_devices
  SET is_active = false,
      updated_at = now()
  WHERE (push_token = v_clean_token OR device_token = v_clean_token)
    AND user_id <> v_user_id
    AND is_active = true;

  BEGIN
    INSERT INTO public.user_devices (
      user_id,
      push_token,
      device_token,
      device_type,
      app_version,
      is_active,
      failure_count,
      last_seen_at,
      updated_at
    )
    VALUES (
      v_user_id,
      v_clean_token,
      v_clean_token,
      COALESCE(nullif(trim(p_device_type), ''), 'android'),
      nullif(trim(COALESCE(p_app_version, '')), ''),
      true,
      0,
      now(),
      now()
    )
    ON CONFLICT (user_id, push_token) DO UPDATE
    SET is_active = true,
        device_token = EXCLUDED.push_token,
        device_type = EXCLUDED.device_type,
        app_version = COALESCE(EXCLUDED.app_version, public.user_devices.app_version),
        failure_count = 0,
        last_seen_at = now(),
        updated_at = now()
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('success', true, 'id', v_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.user_devices
    SET is_active = true,
        device_token = v_clean_token,
        push_token = v_clean_token,
        device_type = COALESCE(nullif(trim(p_device_type), ''), 'android'),
        app_version = COALESCE(nullif(trim(COALESCE(p_app_version, '')), ''), app_version),
        failure_count = 0,
        last_seen_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id
      AND (push_token = v_clean_token OR device_token = v_clean_token)
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      INSERT INTO public.user_devices (
        user_id,
        push_token,
        device_token,
        device_type,
        app_version,
        is_active,
        failure_count,
        last_seen_at,
        updated_at
      )
      VALUES (
        v_user_id,
        v_clean_token,
        v_clean_token,
        COALESCE(nullif(trim(p_device_type), ''), 'android'),
        nullif(trim(COALESCE(p_app_version, '')), ''),
        true,
        0,
        now(),
        now()
      )
      RETURNING id INTO v_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_id);
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_push_token(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.deactivate_device_push_token(
  p_push_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_token text := nullif(trim(COALESCE(p_push_token, '')), '');
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF v_clean_token IS NOT NULL THEN
    UPDATE public.user_devices
    SET is_active = false,
        updated_at = now()
    WHERE user_id = v_user_id
      AND (push_token = v_clean_token OR device_token = v_clean_token)
      AND is_active = true;
  ELSE
    UPDATE public.user_devices
    SET is_active = false,
        updated_at = now()
    WHERE user_id = v_user_id
      AND is_active = true;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deactivated', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_device_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_device_push_token(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Extend public.profiles & public.experiences with Timezone & Marketing Opt-In
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz;

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi';

-- -----------------------------------------------------------------------------
-- 4. Create public.notification_deliveries (Independent Channel Outbox & Receipts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'sms')),
  template_key text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'normal', 'promotional')),
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'dead_letter')
  ),
  provider text,
  provider_message_id text,
  expo_ticket_id text,
  receipt_checked_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_queue
  ON public.notification_deliveries (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_expo_receipts
  ON public.notification_deliveries (sent_at)
  WHERE channel = 'push' AND status = 'sent' AND expo_ticket_id IS NOT NULL AND receipt_checked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user
  ON public.notification_deliveries (user_id, created_at DESC);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Create public.trip_reminders (ZuruPlan Scheduled Reminders)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id text NOT NULL,
  title text NOT NULL,
  destination text,
  remind_at timestamptz NOT NULL,
  window_type text NOT NULL CHECK (window_type IN ('24h', '1h', 'custom')),
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trip_id, window_type)
);

CREATE INDEX IF NOT EXISTS idx_trip_reminders_due
  ON public.trip_reminders (remind_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE public.trip_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_reminders FROM anon;

DROP POLICY IF EXISTS "Users manage own trip reminders" ON public.trip_reminders;
CREATE POLICY "Users manage own trip reminders"
  ON public.trip_reminders FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_reminders TO authenticated;
GRANT ALL ON public.trip_reminders TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Idempotent Server-Only Outbox Helper: public.enqueue_notification_event()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_notification_event(
  p_user_id uuid,
  p_type text,
  p_template_key text,
  p_title text,
  p_message text,
  p_dedupe_key text,
  p_priority text DEFAULT 'normal',
  p_channels text[] DEFAULT ARRAY['in_app', 'push', 'email'],
  p_action_type text DEFAULT NULL,
  p_action_id text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_sender_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_priority text := CASE
    WHEN lower(COALESCE(p_priority, 'normal')) IN ('critical', 'normal', 'promotional')
      THEN lower(p_priority)
    ELSE 'normal'
  END;
  v_notification_id uuid := NULL;
  v_channel text;
  v_merged_payload jsonb;
BEGIN
  IF p_user_id IS NULL OR nullif(trim(COALESCE(p_dedupe_key, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  v_merged_payload := COALESCE(p_payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'type', p_type,
    'template_key', p_template_key,
    'title', p_title,
    'message', p_message,
    'action_type', p_action_type,
    'action_id', p_action_id,
    'image_url', p_image_url
  ));

  -- 1. Persistent in-app notification (idempotent via dedupe_key)
  IF 'in_app' = ANY(COALESCE(p_channels, ARRAY[]::text[])) THEN
    INSERT INTO public.notifications (
      user_id,
      sender_id,
      type,
      title,
      message,
      image_url,
      action_type,
      action_id,
      metadata,
      data,
      priority,
      dedupe_key,
      is_read,
      read,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_sender_id,
      COALESCE(nullif(trim(p_type), ''), 'notification'),
      COALESCE(p_title, 'ZuruSasa'),
      COALESCE(p_message, ''),
      p_image_url,
      p_action_type,
      p_action_id,
      v_merged_payload,
      v_merged_payload,
      v_norm_priority,
      p_dedupe_key,
      false,
      false,
      now(),
      now()
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_notification_id;

    IF v_notification_id IS NULL THEN
      SELECT id INTO v_notification_id
      FROM public.notifications
      WHERE dedupe_key = p_dedupe_key
      LIMIT 1;
    END IF;
  END IF;

  -- 2. Independent async delivery rows (push / email / sms)
  FOREACH v_channel IN ARRAY COALESCE(p_channels, ARRAY[]::text[])
  LOOP
    IF v_channel IN ('push', 'email', 'sms') THEN
      INSERT INTO public.notification_deliveries (
        notification_id,
        user_id,
        channel,
        template_key,
        priority,
        dedupe_key,
        payload,
        status,
        next_retry_at
      ) VALUES (
        v_notification_id,
        p_user_id,
        v_channel,
        COALESCE(nullif(trim(p_template_key), ''), p_type, 'generic'),
        v_norm_priority,
        p_dedupe_key,
        v_merged_payload,
        'pending',
        now()
      )
      ON CONFLICT (dedupe_key, channel) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification_event(uuid, text, text, text, text, text, text, text[], text, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_event(uuid, text, text, text, text, text, text, text[], text, text, text, jsonb, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Harden public.send_notification() Privileged Type Restrictions
-- -----------------------------------------------------------------------------
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
  v_jwt_role text := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_is_privileged boolean := (v_jwt_role = 'service_role' OR session_user IN ('postgres', 'supabase_admin'));
  v_caller_id uuid := auth.uid();
  v_norm_type text := lower(trim(COALESCE(p_type, 'notification')));
  v_has_relationship boolean := false;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id is required');
  END IF;

  IF NOT v_is_privileged THEN
    IF v_caller_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Block forging authoritative booking/payment/payout/refund/KYC/moderation notifications
    IF v_norm_type IN (
      'payment_success',
      'payment_failed',
      'payout_completed',
      'payout_failed',
      'refund_processed',
      'verification',
      'verification_approved',
      'verification_declined',
      'booking_confirmed',
      'booking_request',
      'booking_declined',
      'booking_cancelled',
      'booking_checked_in',
      'arrival_issue_reported',
      'listing_approved',
      'listing_rejected'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden notification type');
    END IF;

    IF p_user_id <> v_caller_id THEN
      SELECT (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE (c.participant_one = v_caller_id AND c.participant_two = p_user_id)
             OR (c.participant_one = p_user_id AND c.participant_two = v_caller_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.booking_quotes bq
          WHERE (bq.guest_id = v_caller_id AND bq.host_id = p_user_id)
             OR (bq.host_id = v_caller_id AND bq.guest_id = p_user_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          JOIN public.experiences e ON e.id = b.experience_id
          WHERE (b.user_id = v_caller_id AND e.user_id = p_user_id)
             OR (e.user_id = v_caller_id AND b.user_id = p_user_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.user_follows uf
          WHERE uf.follower_id = v_caller_id AND uf.following_id = p_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.reel_likes rl
          JOIN public.reels r ON r.id = rl.reel_id
          WHERE rl.user_id = v_caller_id AND r.user_id = p_user_id
        )
      ) INTO v_has_relationship;

      IF NOT COALESCE(v_has_relationship, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: no valid relationship with recipient');
      END IF;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    sender_id,
    type,
    title,
    message,
    metadata,
    data,
    is_read,
    read,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_caller_id,
    COALESCE(p_type, 'notification'),
    COALESCE(p_title, 'New Notification'),
    COALESCE(p_message, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb),
    false,
    false,
    now(),
    now()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. Phase 0 Security & SQL Fixes: public.events RLS + create_booking_quote end_time cast
-- -----------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view events" ON public.events;
CREATE POLICY "Public can view events"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Hosts can insert own events" ON public.events;
CREATE POLICY "Hosts can insert own events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hosts can update own events" ON public.events;
CREATE POLICY "Hosts can update own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hosts can delete own events" ON public.events;
CREATE POLICY "Hosts can delete own events"
  ON public.events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;

CREATE OR REPLACE FUNCTION public.create_booking_quote(
  p_experience_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_guest_count integer,
  p_idempotency_key uuid,
  p_booking_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.booking_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id uuid := auth.uid();
  v_experience record;
  v_host_profile record;
  v_quote public.booking_quotes%ROWTYPE;
  v_meta jsonb := COALESCE(p_booking_meta, '{}'::jsonb);
  v_exp_meta jsonb;
  v_content_type text;
  v_price_unit text;
  v_is_exclusive_stay boolean := true;
  v_is_night_unit boolean := false;
  v_is_flat_unit boolean := false;
  v_booked_guests integer := 0;
  v_units integer := 1;
  v_unit_price numeric := 0;
  v_tier_id text := nullif(trim(COALESCE(v_meta->>'ticket_tier_id', '')), '');
  v_tier_label text := nullif(trim(COALESCE(v_meta->>'ticket_tier_label', '')), '');
  v_tier_match jsonb;
  v_voucher_qty integer := 1;
  v_offer_id_raw text;
  v_offer_row record;
  v_offer_meta_expires_raw text;
  v_offer_expires_at timestamptz;
  v_event_id_raw text;
  v_event_row record;
  v_event_date_raw text;
  v_event_end_raw text;
  v_event_start_at timestamptz;
  v_event_end_at timestamptz;
  v_listing_tz text := 'Africa/Nairobi';
  v_reel_expires_at timestamptz;
  v_subtotal bigint;
  v_host_fee_bps integer := 1500;
  v_host_fee bigint;
  v_setting jsonb;
  v_free_cancellation_until timestamptz;
  v_policy_type text;
  v_cancellation_snapshot jsonb;
  v_terms_snapshot jsonb;
  v_house_rules_snapshot jsonb;
  v_arrival_snapshot jsonb;
  v_checkout_snapshot jsonb;
  v_time_slot text := nullif(trim(COALESCE(v_meta->>'time_slot', '')), '');
  v_seating_pref text := nullif(trim(COALESCE(v_meta->>'seating_preference', '')), '');
  v_special_requests text := nullif(trim(COALESCE(v_meta->>'special_requests', '')), '');
BEGIN
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING errcode = '28000';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'An idempotency key is required' USING errcode = '22023';
  END IF;
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in
     OR p_check_in < (now() - interval '1 day')
     OR p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > 50 THEN
    RAISE EXCEPTION 'Invalid booking dates or guest count' USING errcode = '22023';
  END IF;

  PERFORM public.expire_booking_quotes();

  SELECT * INTO v_quote FROM public.booking_quotes
  WHERE guest_id = v_guest_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_quote; END IF;

  SELECT e.id, e.user_id, e.title, e.category, e.subcategory, e.location, e.current_price, e.price_unit,
         e.availability_status, e.max_guests, e.min_stay_nights, e.max_stay_nights,
         e.check_in_time, e.check_out_time, e.booking_mode, e.cancellation_policy,
         e.house_rules, e.arrival_instructions, e.checkout_instructions, e.image_url,
         e.metadata, COALESCE(nullif(trim(e.timezone), ''), 'Africa/Nairobi') AS timezone
  INTO v_experience FROM public.experiences e
  WHERE e.id = p_experience_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found' USING errcode = 'P0002'; END IF;
  IF v_experience.user_id = v_guest_id THEN
    RAISE EXCEPTION 'Hosts cannot book their own listing' USING errcode = '22023';
  END IF;
  IF COALESCE(v_experience.availability_status, 'available') <> 'available' THEN
    RAISE EXCEPTION 'Listing is not available' USING errcode = 'P0001';
  END IF;

  v_listing_tz := v_experience.timezone;
  v_exp_meta := COALESCE(v_experience.metadata, '{}'::jsonb);
  v_content_type := lower(COALESCE(
    nullif(v_exp_meta->>'content_type', ''),
    CASE
      WHEN lower(COALESCE(v_experience.category, '')) IN ('event', 'events') THEN 'event'
      WHEN lower(COALESCE(v_experience.category, '')) IN ('special_offer', 'offer', 'special_offers') THEN 'special_offer'
      ELSE 'experience'
    END
  ));

  SELECT r.expires_at INTO v_reel_expires_at
  FROM public.reels r
  WHERE r.experience_id = p_experience_id
    AND r.expires_at IS NOT NULL
  ORDER BY r.created_at DESC
  LIMIT 1;

  -- Special Offer expiry & active status guard
  IF v_content_type = 'special_offer' THEN
    v_offer_id_raw := nullif(trim(COALESCE(v_exp_meta->'offer_details'->>'offer_id', '')), '');
    IF v_offer_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT o.id, o.status, o.expires_at INTO v_offer_row
      FROM public.special_offers o
      WHERE o.id = v_offer_id_raw::uuid;

      IF FOUND THEN
        IF lower(COALESCE(v_offer_row.status, 'active')) <> 'active' THEN
          RAISE EXCEPTION 'This special offer is no longer active' USING errcode = 'P0001';
        END IF;
        v_offer_expires_at := v_offer_row.expires_at;
      END IF;
    END IF;

    IF v_offer_expires_at IS NULL THEN
      v_offer_meta_expires_raw := nullif(trim(COALESCE(v_exp_meta->'offer_details'->>'expires_at', '')), '');
      IF v_offer_meta_expires_raw IS NOT NULL AND v_offer_meta_expires_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
        BEGIN
          v_offer_expires_at := v_offer_meta_expires_raw::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_offer_expires_at := NULL;
        END;
      END IF;
    END IF;

    v_offer_expires_at := COALESCE(v_offer_expires_at, v_reel_expires_at);

    IF v_offer_expires_at IS NOT NULL AND v_offer_expires_at <= now() THEN
      RAISE EXCEPTION 'This special offer has expired and can no longer be claimed' USING errcode = 'P0001';
    END IF;

    IF v_offer_expires_at IS NOT NULL AND p_check_in > v_offer_expires_at THEN
      RAISE EXCEPTION 'Selected redemption date must be on or before the offer expiry' USING errcode = '22023';
    END IF;
  END IF;

  -- Event start/end guard (safely handles text clock end_time like '23:30' without cast crash)
  IF v_content_type = 'event' THEN
    v_event_id_raw := nullif(trim(COALESCE(v_exp_meta->'event_details'->>'event_id', '')), '');
    IF v_event_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT ev.id, ev.status, ev.event_date, ev.end_date, ev.end_time, ev.expires_at INTO v_event_row
      FROM public.events ev
      WHERE ev.id = v_event_id_raw::uuid;

      IF FOUND THEN
        IF lower(COALESCE(v_event_row.status, 'active')) <> 'active' THEN
          RAISE EXCEPTION 'This event is no longer active' USING errcode = 'P0001';
        END IF;
        v_event_start_at := v_event_row.event_date;
        v_event_end_at := COALESCE(v_event_row.end_date, v_event_row.expires_at);

        IF v_event_end_at IS NULL AND nullif(trim(COALESCE(v_event_row.end_time, '')), '') IS NOT NULL THEN
          v_event_end_raw := trim(v_event_row.end_time);
          IF v_event_end_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
            BEGIN
              v_event_end_at := v_event_end_raw::timestamptz;
            EXCEPTION WHEN OTHERS THEN
              v_event_end_at := NULL;
            END;
          ELSIF v_event_end_raw ~ '^\d{1,2}:\d{2}(:\d{2})?$' AND v_event_start_at IS NOT NULL THEN
            BEGIN
              v_event_end_at := ((timezone(v_listing_tz, v_event_start_at)::date + v_event_end_raw::time) AT TIME ZONE v_listing_tz);
              IF v_event_end_at <= v_event_start_at THEN
                v_event_end_at := v_event_end_at + interval '1 day';
              END IF;
            EXCEPTION WHEN OTHERS THEN
              v_event_end_at := NULL;
            END;
          END IF;
        END IF;
      END IF;
    END IF;

    IF v_event_start_at IS NULL THEN
      v_event_date_raw := nullif(trim(COALESCE(v_exp_meta->'event_details'->>'event_date', '')), '');
      IF v_event_date_raw IS NOT NULL AND v_event_date_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
        BEGIN
          v_event_start_at := v_event_date_raw::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_event_start_at := NULL;
        END;
      END IF;
    END IF;

    IF v_event_end_at IS NULL THEN
      v_event_end_raw := nullif(trim(COALESCE(
        nullif(v_exp_meta->'event_details'->>'end_date', ''),
        v_exp_meta->'event_details'->>'expires_at'
      )), '');
      IF v_event_end_raw IS NOT NULL AND v_event_end_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
        BEGIN
          v_event_end_at := v_event_end_raw::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_event_end_at := NULL;
        END;
      END IF;
    END IF;

    v_event_end_at := COALESCE(v_event_end_at, v_reel_expires_at);

    IF (v_event_start_at IS NOT NULL AND v_event_start_at <= now())
       OR (v_event_end_at IS NOT NULL AND v_event_end_at <= now()) THEN
      RAISE EXCEPTION 'Ticket reservations close once the event starts or ends' USING errcode = 'P0001';
    END IF;
  END IF;

  v_price_unit := lower(COALESCE(nullif(trim(v_experience.price_unit), ''), 'night'));
  v_is_night_unit := v_price_unit IN ('night', 'nights', 'per_night');
  v_is_flat_unit := v_price_unit IN (
    'group', 'groups', 'per_group',
    'boat', 'boats', 'charter', 'charters',
    'trip', 'trips', 'booking', 'bookings',
    'table', 'tables',
    'offer', 'offers', 'package', 'packages', 'bundle', 'deal',
    'session', 'sessions', 'vehicle', 'vehicles'
  );

  v_is_exclusive_stay :=
    v_content_type NOT IN ('special_offer', 'event')
    AND lower(COALESCE(v_experience.category, '')) IN ('accommodation', 'hotel', 'villa', 'apartment', 'stay', 'stays')
    AND v_is_night_unit;

  IF v_experience.max_guests IS NOT NULL AND p_guest_count > v_experience.max_guests THEN
    RAISE EXCEPTION 'Guest count exceeds maximum capacity of % guests', v_experience.max_guests USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.host_blocked_dates h
    WHERE h.experience_id = p_experience_id
      AND h.start_date < (timezone(v_listing_tz, p_check_out))::date
      AND h.end_date > (timezone(v_listing_tz, p_check_in))::date
  ) THEN
    RAISE EXCEPTION 'Those dates are blocked by the host' USING errcode = 'P0001';
  END IF;

  IF v_is_exclusive_stay THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.experience_id = p_experience_id
        AND COALESCE(b.status, 'pending') NOT IN ('cancelled', 'declined', 'refunded', 'failed')
        AND b.check_in < p_check_out AND b.check_out > p_check_in
    ) THEN
      RAISE EXCEPTION 'Those dates are no longer available' USING errcode = 'P0001';
    END IF;
  ELSE
    SELECT COALESCE(SUM(b.guests), 0)::integer
    INTO v_booked_guests
    FROM public.bookings b
    WHERE b.experience_id = p_experience_id
      AND COALESCE(b.status, 'pending') NOT IN ('cancelled', 'declined', 'refunded', 'failed')
      AND b.check_in < p_check_out AND b.check_out > p_check_in;

    IF v_experience.max_guests IS NOT NULL AND (v_booked_guests + p_guest_count) > v_experience.max_guests THEN
      RAISE EXCEPTION 'Capacity reached (% spots remaining)', greatest(0, v_experience.max_guests - v_booked_guests) USING errcode = 'P0001';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.external_calendar_blocks eb
    WHERE eb.experience_id = p_experience_id
      AND eb.start_date < (timezone(v_listing_tz, p_check_out))::date
      AND eb.end_date > (timezone(v_listing_tz, p_check_in))::date
  ) THEN
    RAISE EXCEPTION 'Those dates are blocked by external calendar sync' USING errcode = 'P0001';
  END IF;

  v_unit_price := COALESCE(v_experience.current_price, 0);
  IF v_content_type = 'event' AND v_tier_id IS NOT NULL AND jsonb_typeof(v_exp_meta->'event_details'->'ticket_tiers') = 'array' THEN
    SELECT elem INTO v_tier_match
    FROM jsonb_array_elements(v_exp_meta->'event_details'->'ticket_tiers') elem
    WHERE elem->>'id' = v_tier_id
    LIMIT 1;

    IF v_tier_match IS NOT NULL AND (v_tier_match->>'price') IS NOT NULL THEN
      v_unit_price := GREATEST(0, (v_tier_match->>'price')::numeric);
      v_tier_label := COALESCE(nullif(trim(v_tier_match->>'label'), ''), v_tier_label, v_tier_id);
    END IF;
  END IF;

  IF v_unit_price IS NULL OR v_unit_price < 0 THEN
    RAISE EXCEPTION 'Listing price is unavailable' USING errcode = 'P0001';
  END IF;

  SELECT bq.* INTO v_quote
  FROM public.booking_quotes bq
  WHERE bq.guest_id = v_guest_id
    AND bq.experience_id = p_experience_id
    AND bq.expires_at > now()
    AND (
      bq.status = 'quote_locked'
      OR (
        bq.status = 'payment_pending'
        AND NOT EXISTS (
          SELECT 1 FROM public.payment_attempts pa
          WHERE pa.quote_id = bq.id AND pa.status IN ('created', 'pending')
        )
      )
    )
    AND bq.check_in = p_check_in
    AND bq.check_out = p_check_out
    AND bq.guest_count = p_guest_count
    AND COALESCE(bq.terms_snapshot->>'time_slot', '') = COALESCE(v_time_slot, '')
    AND COALESCE(bq.terms_snapshot->>'ticket_tier_id', '') = COALESCE(v_tier_id, '')
    AND COALESCE(bq.terms_snapshot->>'seating_preference', '') = COALESCE(v_seating_pref, '')
  ORDER BY bq.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.booking_quotes bq
    SET status = 'quote_locked',
        is_exclusive_stay = v_is_exclusive_stay,
        expires_at = now() + interval '15 minutes',
        updated_at = now()
    WHERE bq.id = v_quote.id
    RETURNING * INTO v_quote;

    RETURN v_quote;
  END IF;

  UPDATE public.booking_quotes bq
  SET status = 'cancelled',
      updated_at = now()
  WHERE bq.guest_id = v_guest_id
    AND bq.experience_id = p_experience_id
    AND (
      bq.status = 'quote_locked'
      OR (
        bq.status = 'payment_pending'
        AND NOT EXISTS (
          SELECT 1 FROM public.payment_attempts pa
          WHERE pa.quote_id = bq.id AND pa.status IN ('created', 'pending')
        )
      )
    );

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'commission';
  IF v_setting ? 'host_fee_bps' THEN v_host_fee_bps := (v_setting->>'host_fee_bps')::integer; END IF;
  IF v_host_fee_bps < 0 OR v_host_fee_bps > 10000 THEN
    RAISE EXCEPTION 'Invalid platform commission configuration' USING errcode = 'P0001';
  END IF;

  IF (v_meta->>'voucher_qty') ~ '^\d+$' THEN
    v_voucher_qty := greatest(1, least(20, (v_meta->>'voucher_qty')::integer));
  END IF;

  IF v_is_night_unit THEN
    v_units := greatest(1, ceil(extract(epoch from (p_check_out - p_check_in)) / 86400.0)::integer);
  ELSIF v_is_flat_unit THEN
    v_units := CASE WHEN v_content_type = 'special_offer' THEN v_voucher_qty ELSE 1 END;
  ELSE
    v_units := p_guest_count;
  END IF;

  IF v_is_night_unit AND v_experience.min_stay_nights IS NOT NULL AND v_units < v_experience.min_stay_nights THEN
    RAISE EXCEPTION 'Minimum stay is % nights', v_experience.min_stay_nights USING errcode = '22023';
  END IF;

  v_subtotal := round(v_unit_price * v_units * 100)::bigint;
  v_host_fee := round(v_subtotal * (v_host_fee_bps / 10000.0))::bigint;

  v_policy_type := COALESCE(v_experience.cancellation_policy, 'flexible');
  IF v_policy_type = 'strict' THEN
    v_free_cancellation_until := least(p_check_in - interval '7 days', now() + interval '48 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'strict',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 5000,
      'policy_note', 'Full refund if cancelled at least 7 days before start. 50% refund thereafter up to 48h before start.'
    );
  ELSIF v_policy_type = 'moderate' THEN
    v_free_cancellation_until := least(p_check_in - interval '5 days', now() + interval '48 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'moderate',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 5000,
      'policy_note', 'Full refund up to 5 days before start. Partial refund thereafter.'
    );
  ELSE
    v_free_cancellation_until := least(p_check_in - interval '24 hours', now() + interval '24 hours');
    v_cancellation_snapshot := jsonb_build_object(
      'policy_type', 'flexible',
      'free_cancellation_until', v_free_cancellation_until,
      'after_free_cancellation_refund_bps', 0,
      'policy_note', 'Full refund up to 24 hours before start. Non-refundable after start.'
    );
  END IF;

  SELECT full_name INTO v_host_profile FROM public.profiles WHERE id = v_experience.user_id;

  v_terms_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'title', v_experience.title,
    'category', v_experience.category,
    'subcategory', v_experience.subcategory,
    'content_type', v_content_type,
    'price_unit', v_price_unit,
    'unit_price', v_unit_price,
    'units', v_units,
    'location', v_experience.location,
    'timezone', v_listing_tz,
    'host_name', COALESCE(v_host_profile.full_name, 'Host'),
    'check_in_time', COALESCE(v_time_slot, v_experience.check_in_time, '14:00'),
    'check_out_time', v_experience.check_out_time,
    'booking_mode', COALESCE(v_experience.booking_mode, 'approval_required'),
    'image_url', v_experience.image_url,
    'time_slot', v_time_slot,
    'seating_preference', v_seating_pref,
    'special_requests', v_special_requests,
    'ticket_tier_id', v_tier_id,
    'ticket_tier_label', v_tier_label,
    'duration_info', nullif(v_exp_meta->>'duration_info', ''),
    'meeting_point', nullif(v_exp_meta->>'meeting_point', ''),
    'discount_label', nullif(v_exp_meta->'offer_details'->>'discount_label', ''),
    'original_price', CASE
      WHEN (v_exp_meta->'offer_details'->>'original_price') IS NOT NULL
      THEN (v_exp_meta->'offer_details'->>'original_price')::numeric
      ELSE NULL
    END
  ));

  v_house_rules_snapshot := COALESCE(v_experience.house_rules, '{}'::jsonb);
  v_arrival_snapshot := COALESCE(v_experience.arrival_instructions, '{}'::jsonb);
  v_checkout_snapshot := COALESCE(v_experience.checkout_instructions, '{}'::jsonb);

  INSERT INTO public.booking_quotes (
    guest_id, host_id, experience_id, idempotency_key, check_in, check_out, guest_count,
    is_exclusive_stay,
    pricing_snapshot, cancellation_policy_snapshot, terms_snapshot, house_rules_snapshot,
    arrival_snapshot, checkout_snapshot, subtotal_amount, guest_service_fee_amount,
    tax_amount, total_amount, host_service_fee_amount, host_payout_amount,
    terms_acknowledged_at
  ) VALUES (
    v_guest_id, v_experience.user_id, p_experience_id, p_idempotency_key, p_check_in, p_check_out, p_guest_count,
    v_is_exclusive_stay,
    jsonb_build_object(
      'listing_unit_price', v_unit_price,
      'listing_price_unit', v_price_unit,
      'units', v_units,
      'currency', 'KES',
      'price_scale', 100,
      'host_fee_bps', v_host_fee_bps
    ),
    v_cancellation_snapshot,
    v_terms_snapshot,
    v_house_rules_snapshot,
    v_arrival_snapshot,
    v_checkout_snapshot,
    v_subtotal, 0, 0, v_subtotal, v_host_fee, v_subtotal - v_host_fee,
    now()
  ) RETURNING * INTO v_quote;

  RETURN v_quote;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_quote(uuid, timestamptz, timestamptz, integer, uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
