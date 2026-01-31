
-- Enable the pg_net extension to make HTTP requests
create extension if not exists "pg_net" with schema "extensions";

-- Create a generic function to trigger the email
create or replace function public.handle_auth_emails()
returns trigger as $$
declare
  project_url text := 'https://rjzgzxxdrltlteeshtuw.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA';
  function_url text := project_url || '/functions/v1/send-email';
  request_body jsonb;
begin
  -- 1. Handle Signup Verification (INSERT on auth.users)
  if (TG_OP = 'INSERT') and (TG_TABLE_NAME = 'users') then
    request_body := jsonb_build_object(
      'type', 'verification',
      'email', new.email,
      'data', jsonb_build_object(
        'token', new.confirmation_token,
        'redirect_to', new.raw_user_meta_data->>'user_redirect_to'
      )
    );

  -- 2. Handle Password Reset (UPDATE on auth.users where recovery_token changes)
  elsif (TG_OP = 'UPDATE') and (TG_TABLE_NAME = 'users') then
    if (old.recovery_token is distinct from new.recovery_token) and (new.recovery_token is not null) then
      request_body := jsonb_build_object(
        'type', 'reset_password',
        'email', new.email,
        'data', jsonb_build_object(
          'token', new.recovery_token,
          'redirect_to', new.raw_user_meta_data->>'user_redirect_to'
        )
      );
    else
      return new; -- No change in recovery token, ignore
    end if;

  -- 3. Handle Login Alert (INSERT on auth.sessions) - OPTIONAL (Can be noisy)
  -- Only trigger if the user has requested it (we'd need to check profile settings, but triggers are limited)
  -- or just blindly send it for now as requested.
  /*
  elsif (TG_OP = 'INSERT') and (TG_TABLE_NAME = 'sessions') then
    -- We need to fetch email from auth.users
    -- This is complex in a trigger because of potential recursion or permissions.
    -- Simplifying: We'll skip sessions for now to avoid breaking basic auth flows with complexity.
    return new; 
  */
  
  else
    return new;
  end if;

  -- Make the HTTP request
  perform
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := request_body
    );

  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Signup Verification
drop trigger if exists on_auth_user_created_email on auth.users;
create trigger on_auth_user_created_email
  after insert on auth.users
  for each row execute procedure public.handle_auth_emails();

-- Trigger: Password Reset
drop trigger if exists on_auth_user_updated_email on auth.users;
create trigger on_auth_user_updated_email
  after update on auth.users
  for each row execute procedure public.handle_auth_emails();

-- Note: We are currently NOT triggering on auth.sessions to prevent spam/performance issues 
-- until we have a robust way to check user preferences inside the trigger.
