
-- Drop the triggers that were hijacking Supabase Auth
drop trigger if exists on_auth_user_created_email on auth.users;
drop trigger if exists on_auth_user_updated_email on auth.users;

-- Drop the function
drop function if exists public.handle_auth_emails();
drop function if exists public.handle_new_user_email();

-- NOTE: We are NOT dropping the send-email Edge Function or the pg_net extension, 
-- because we still might want to use them for "Welcome" emails or "Security Alerts".
