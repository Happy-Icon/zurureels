-- DANGER: THIS SCRIPT DELETES ALL USERS AND RELATED DATA
-- Use this to reset your database for testing.

-- 1. Delete data from dependent tables (Child tables first)
DELETE FROM public.reels;         -- References experiences
DELETE FROM public.bookings;      -- References users/experiences
DELETE FROM public.reviews;       -- References users/experiences (if exists)
DELETE FROM public.messages;      -- References users (if exists)

-- 2. Delete data from main entity tables
DELETE FROM public.experiences;   -- References users
DELETE FROM public.payment_methods; -- References users

-- 3. Delete profiles (References users)
DELETE FROM public.profiles;

-- 4. Delete the actual users from Supabase Auth
DELETE FROM auth.users;
