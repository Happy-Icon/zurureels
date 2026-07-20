-- REPAIR SCRIPT: Fix profiles table schema and handle_new_user trigger
-- Run this in your Supabase SQL Editor to resolve the '42703' (Undefined Column) error.

BEGIN;

-- 1. Ensure all required columns exist in public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS role text DEFAULT 'guest',
ADD COLUMN IF NOT EXISTS security_settings jsonb DEFAULT '{"two_factor": false, "login_alerts": true, "sms_notifications": false}'::jsonb;

-- 2. Ensure reels table has required columns for the feed
ALTER TABLE public.reels
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processed_video_url text,
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'ready';

-- 3. Update the handle_new_user function with more robust metadata handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, phone, email, role, security_settings)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'User'
    ),
    COALESCE(
      new.raw_user_meta_data ->> 'username',
      new.raw_user_meta_data ->> 'preferred_username',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'role', 'guest'),
    '{"two_factor": false, "login_alerts": true, "sms_notifications": false}'::jsonb
  );
  RETURN new;
END;
$$;

-- 4. Re-create the trigger to be sure
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;

-- VERIFICATION:
-- SELECT * FROM public.profiles LIMIT 1;
