-- Database Trigger: Send Welcome Email on Email Verification
-- Triggered when auth.users.email_confirmed_at changes from NULL to a value.

CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 1. Create the hook function
CREATE OR REPLACE FUNCTION public.handle_user_verification()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
BEGIN
  -- Check if email was just confirmed
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    
    -- Get the user's name from profiles (if available)
    SELECT full_name INTO user_name FROM public.profiles WHERE id = NEW.id;
    
    -- If no name found, default to 'Member'
    IF user_name IS NULL THEN
      user_name := 'Member';
    END IF;

    -- Call the Edge Function
    PERFORM
      net.http_post(
        url := 'https://rjzgzxxdrltlteeshtuw.supabase.co/functions/v1/send-email',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA"}'::jsonb,
        body := jsonb_build_object(
          'type', 'welcome',
          'email', NEW.email,
          'data', jsonb_build_object('name', user_name)
        )
      );
      
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on auth.users
-- Note: Requires superuser access usually, but effectively we might need to do this in the dashboard if we can't here.
-- Assuming we can run this via SQL Editor.
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_verification();
