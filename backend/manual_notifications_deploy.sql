-- =============================================================================
-- ZURU REELS NOTIFICATION SYSTEM (MANUAL DEPLOYMENT SCRIPT)
-- Copy and paste this entire block into the Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- 1. Create Notifications Table
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    type text not null check (type in ('booking_request', 'booking_confirmed', 'booking_declined', 'payout', 'system', 'message')),
    title text not null,
    body text not null,
    data jsonb default '{}'::jsonb,
    is_read boolean default false,
    created_at timestamp with time zone default now() not null
);

-- 2. Performance Indexes
-- -----------------------------------------------------------------------------
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id) where is_read = false;

-- 3. Row Level Security (RLS)
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;

-- Policy: Users see only their own notifications
create policy "Users can view their own notifications"
    on public.notifications for select
    using (auth.uid() = user_id);

-- Policy: Server functions/triggers can insert notifications
create policy "Server permissions for notifications"
    on public.notifications for insert
    with check (true);

-- 4. Helper Function: create_notification
-- -----------------------------------------------------------------------------
create or replace function public.create_notification(
    p_user_id uuid,
    p_type text,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
) returns uuid as $$
declare
    v_id uuid;
begin
    insert into public.notifications (user_id, type, title, body, data)
    values (p_user_id, p_type, p_title, p_body, p_data)
    returning id into v_id;
    return v_id;
end;
$$ language plpgsql security definer;

-- 5. Webhook Extension & Trigger (Optional for Local, Required for Prod)
-- -----------------------------------------------------------------------------
create extension if not exists "pg_net";

-- NOTE: Replace <PROJECT_REF> and <ANON_KEY> below before uncommenting in production
create or replace function public.trigger_push_notification()
returns trigger as $$
begin
    -- perform net.http_post(
    --     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-notification',
    --     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    --     body := jsonb_build_object('record', new)
    -- );
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_notification_created
after insert on public.notifications
for each row execute function public.trigger_push_notification();

COMMIT;

-- 6. Verification
-- -----------------------------------------------------------------------------
-- After running, verify by checking if the table exists:
-- SELECT * FROM public.notifications;
