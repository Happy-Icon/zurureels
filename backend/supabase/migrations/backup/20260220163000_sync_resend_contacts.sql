-- Enable the pg_net extension to make HTTP requests
create extension if not exists "pg_net" with schema "extensions";

-- Create a generic function to trigger the contact sync
create or replace function public.handle_resend_contact_sync()
returns trigger as $$
declare
  -- Replace with your actual project URL and anon key, or better, use Vault/Environment variables if supported by your setup
  project_url text := current_setting('app.settings.supabase_url', true); 
  anon_key text := current_setting('app.settings.supabase_anon_key', true);
  function_url text := 'https://rjzgzxxdrltlteeshtuw.supabase.co/functions/v1/sync-resend-contacts';
  auth_header text := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA';
  request_body jsonb;
begin
  -- For INSERT, old is null. For UPDATE, old is the previous record.
  request_body := jsonb_build_object(
    'record', row_to_json(new),
    'old_record', case when TG_OP = 'UPDATE' then row_to_json(old) else null end
  );

  -- Make the HTTP request
  perform
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', auth_header
      ),
      body := request_body
    );

  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Sync on INSERT (new profile created)
drop trigger if exists on_profile_created_sync_resend on public.profiles;
create trigger on_profile_created_sync_resend
  after insert on public.profiles
  for each row execute procedure public.handle_resend_contact_sync();

-- Trigger: Sync on UPDATE (profile updated, e.g. newsletter preference changed)
drop trigger if exists on_profile_updated_sync_resend on public.profiles;
create trigger on_profile_updated_sync_resend
  after update on public.profiles
  for each row execute procedure public.handle_resend_contact_sync();
