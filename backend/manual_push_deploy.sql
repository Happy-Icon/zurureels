-- =============================================================================
-- PUSH NOTIFICATION SETUP (MANUAL DEPLOYMENT PART 2)
-- Run this in Supabase SQL Editor to enable device tracking.
-- =============================================================================

BEGIN;

-- 1. Create User Devices Table
-- Stores OneSignal Player IDs (or FCM tokens) for each user.
-- One user can have multiple devices (e.g., Laptop + iPhone).
create table if not exists public.user_devices (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    device_token text not null, -- The OneSignal Player ID
    platform text check (platform in ('web', 'ios', 'android')),
    last_active timestamp with time zone default now(),
    created_at timestamp with time zone default now() not null,
    unique(user_id, device_token) -- Prevent duplicate tokens for same user
);

-- 2. RLS Policies
alter table public.user_devices enable row level security;

-- Users can Insert/Select their own devices
create policy "Users can manage their own devices"
    on public.user_devices
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- 3. Function to Register Device (Idempotent)
create or replace function public.register_device(
    p_device_token text,
    p_platform text
) returns void as $$
begin
    insert into public.user_devices (user_id, device_token, platform, last_active)
    values (auth.uid(), p_device_token, p_platform, now())
    on conflict (user_id, device_token) 
    do update set last_active = now();
end;
$$ language plpgsql security definer;

COMMIT;

-- 4. Verification
-- SELECT * FROM public.user_devices;
