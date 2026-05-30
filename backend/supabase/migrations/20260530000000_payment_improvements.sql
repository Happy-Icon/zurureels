-- SQL Migration: ZuruSasa Payment & Payout Improvements

-- 1. Add refund_amount column to bookings table to track partial refunds
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0;

-- 2. Enable pg_cron and schedule the automate-payouts Edge Function
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Set up automated schedule using Supabase net extension if present
-- Otherwise, cron can call postgres functions or standard endpoints.
-- This schedules the job to run every day at 2:00 AM UTC.
SELECT cron.schedule(
    'automate-payouts-daily',
    '0 2 * * *',
    $$
    SELECT
      net.http_post(
        url := 'http://kong:8000/functions/v1/automate-payouts',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), '') || '"}'::jsonb,
        body := '{}'::jsonb
      );
    $$
);
