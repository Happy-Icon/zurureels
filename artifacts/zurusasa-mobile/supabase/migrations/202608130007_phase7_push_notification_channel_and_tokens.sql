-- Migration: 202608130007_phase7_push_notification_channel_and_tokens.sql
-- Adds is_active column & index on user_devices for active multi-device push token filtering

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_devices_active_user
  ON public.user_devices (user_id, is_active);
