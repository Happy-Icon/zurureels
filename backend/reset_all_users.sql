-- DANGER: THIS SCRIPT DELETES ALL USERS AND RELATED DATA
-- Use this to reset your database for testing.

-- 1. Delete data from public tables that reference auth.users
-- We must do this first because of Foreign Key constraints (unless ON DELETE CASCADE is set)
DELETE FROM public.bookings;
DELETE FROM public.payment_methods;
DELETE FROM public.experiences;
DELETE FROM public.profiles;

-- 2. Delete the actual users from Supabase Auth
DELETE FROM auth.users;

-- 3. (Optional) Reset sequences if you had any serial columns (e.g. not UUIDs)
-- ALTER SEQUENCE table_id_seq RESTART WITH 1;
