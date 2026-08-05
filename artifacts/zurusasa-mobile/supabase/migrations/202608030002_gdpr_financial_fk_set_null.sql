-- ============================================================================
-- Migration: Alter retention FKs to ON DELETE SET NULL (GDPR pre-requisite)
-- File: 202608030002_gdpr_financial_fk_set_null.sql
--
-- When a user deletes their account we hard-delete the auth.users row.
-- Tables that hold *other* users' financial records (booking_quotes,
-- payment_attempts, host_payouts, bookings) must keep those rows intact
-- with the deleting user's id column set to NULL.
--
-- experiences.user_id is also switched to SET NULL so that booked listings
-- survive de-identified; unbooked listings are hard-deleted by the RPC.
-- ============================================================================

-- ────────────────────────── booking_quotes.guest_id ──────────────────────────
ALTER TABLE public.booking_quotes
  DROP CONSTRAINT IF EXISTS booking_quotes_guest_id_fkey;

ALTER TABLE public.booking_quotes
  ALTER COLUMN guest_id DROP NOT NULL;

ALTER TABLE public.booking_quotes
  ADD CONSTRAINT booking_quotes_guest_id_fkey
  FOREIGN KEY (guest_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────── booking_quotes.host_id ───────────────────────────
ALTER TABLE public.booking_quotes
  DROP CONSTRAINT IF EXISTS booking_quotes_host_id_fkey;

ALTER TABLE public.booking_quotes
  ALTER COLUMN host_id DROP NOT NULL;

ALTER TABLE public.booking_quotes
  ADD CONSTRAINT booking_quotes_host_id_fkey
  FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────── payment_attempts.guest_id ────────────────────────
ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_guest_id_fkey;

ALTER TABLE public.payment_attempts
  ALTER COLUMN guest_id DROP NOT NULL;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_guest_id_fkey
  FOREIGN KEY (guest_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────── host_payouts.host_id ─────────────────────────────
ALTER TABLE public.host_payouts
  DROP CONSTRAINT IF EXISTS host_payouts_host_id_fkey;

ALTER TABLE public.host_payouts
  ALTER COLUMN host_id DROP NOT NULL;

ALTER TABLE public.host_payouts
  ADD CONSTRAINT host_payouts_host_id_fkey
  FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────── bookings.user_id ─────────────────────────────────
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;

ALTER TABLE public.bookings
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────── experiences.user_id ──────────────────────────────
-- Booked experiences are retained (booking_quotes.experience_id RESTRICT
-- prevents their deletion). Switching to SET NULL lets the auth.users row
-- be deleted while keeping the listing row for the counterparty.
ALTER TABLE public.experiences
  DROP CONSTRAINT IF EXISTS experiences_user_id_fkey;

ALTER TABLE public.experiences
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
