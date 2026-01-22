-- Create Reels Table with Robust Constraints

create table if not exists reels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  experience_id uuid references experiences(id) not null,
  category text not null, -- matches experiences.category
  
  -- Media content
  video_url text not null,
  thumbnail_url text,
  
  -- Robust Constraints
  duration integer not null check (duration <= 20), -- Hard limit: max 20 seconds
  
  -- Lifecycle management
  status text default 'active', -- 'active', 'expired', 'archived'
  expires_at timestamp with time zone default (now() + interval '90 days') not null,
  
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Indexes for querying active reels
create index if not exists idx_reels_experience_id on reels(experience_id);
create index if not exists idx_reels_status_expires on reels(status, expires_at);
create index if not exists idx_reels_category on reels(category);

-- Enable RLS
alter table reels enable row level security;

-- Policies
create policy "Public reels are visible if active and not expired" on reels
for select to anon, authenticated
using (status = 'active' and expires_at > now());

create policy "Hosts can view all their own reels" on reels
for select to authenticated
using (auth.uid() = user_id);

create policy "Hosts can create reels for their experiences" on reels
for insert to authenticated
with check (
    auth.uid() = user_id 
    and exists (
        select 1 from experiences 
        where id = experience_id 
        and user_id = auth.uid()
    )
);

create policy "Hosts can update their own reels" on reels
for update to authenticated
using (auth.uid() = user_id);

-- Add booking reference to reels (optional direct booking link)
-- Note: schema.sql already has bookings, but we might want to link bookings to specific reels for attribution
alter table bookings 
add column if not exists reel_id uuid references reels(id);
