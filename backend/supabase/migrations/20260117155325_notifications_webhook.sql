-- Trigger for Push Notifications
-- This function is designed to call the Edge Function when a new notification is inserted.
-- In production, enabling the 'pg_net' extension is required.

create extension if not exists "pg_net";

create or replace function public.trigger_push_notification()
returns trigger as $$
begin
    -- This call is commented out by default to prevent errors in local dev without extensions or secrets.
    -- To enable, uncomment and replace <PROJECT_REF> and <ANON_KEY> with valid values.
    
    /*
    perform net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-notification',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
        body := jsonb_build_object('record', new)
    );
    */
    
    return new;
end;
$$ language plpgsql security definer;

create trigger on_notification_created
after insert on public.notifications
for each row execute function public.trigger_push_notification();
