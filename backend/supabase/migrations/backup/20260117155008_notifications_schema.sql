-- Create Notifications Table
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

-- Indexes for performance
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id) where is_read = false;

-- Enable RLS
alter table public.notifications enable row level security;

-- Policies
create policy "Users can view their own notifications"
    on public.notifications for select
    using (auth.uid() = user_id);

create policy "Server permissions for notifications"
    on public.notifications for insert
    with check (true); -- triggers/functions need to insert

-- Helper Function (Internal)
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
