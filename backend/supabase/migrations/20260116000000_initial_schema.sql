-- Database Schema for ZuruReels (Idempotent Version)

-- 1. PROFILES
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  phone text,
  metadata jsonb
);
alter table profiles enable row level security;
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- 2. PAYMENT METHODS
create table if not exists payment_methods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  provider text default 'paystack',
  reference text,
  authorization_code text,
  last4 text, 
  brand text,
  created_at timestamp with time zone default now() not null
);
alter table payment_methods enable row level security;
drop policy if exists "Users can view own methods" on payment_methods;
drop policy if exists "Users can add own methods" on payment_methods;
create policy "Users can view own methods" on payment_methods for select using (auth.uid() = user_id);
create policy "Users can add own methods" on payment_methods for insert with check (auth.uid() = user_id);

-- 3. BOOKINGS
create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  trip_title text not null,
  amount numeric not null,
  status text default 'pending', -- pending, paid, cancelled
  payment_reference text,
  created_at timestamp with time zone default now() not null
);
alter table bookings enable row level security;
drop policy if exists "Users can view own bookings" on bookings;
drop policy if exists "Users can insert own bookings" on bookings;
create policy "Users can view own bookings" on bookings for select using (auth.uid() = user_id);
create policy "Users can insert own bookings" on bookings for insert with check (auth.uid() = user_id);

-- 4. EXPERIENCES
create table if not exists experiences (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) not null,
    category text not null, -- 'boats', 'food', 'nightlife', 'bikes', 'drinks', 'activities'
    entity_name text not null, -- e.g., "Sails Beach Bar"
    title text not null, -- e.g., "Seafood Platter for 2"
    description text,
    location text not null, -- e.g., "Diani Beach"
    image_url text,
    base_price numeric,
    current_price numeric not null,
    price_unit text default 'person', -- 'person', 'day', 'hour', 'half day'
    availability_status text default 'available', -- 'available', 'booked_out', 'limited'
    metadata jsonb default '{}'::jsonb, -- Store category-specific fields (dj, chef, duration, spots_left, rating)
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- Indexes for performance
create index if not exists idx_experiences_category on experiences(category);
create index if not exists idx_experiences_location on experiences(location);
create index if not exists idx_experiences_user_id on experiences(user_id);

alter table experiences enable row level security;

-- Policies for public (anon) and authenticated users
drop policy if exists "Public experiences are visible to everyone" on experiences;
drop policy if exists "Authenticated users can create experiences" on experiences;
drop policy if exists "Authenticated users can update their own experiences" on experiences;
drop policy if exists "Authenticated users can delete their own experiences" on experiences;

create policy "Public experiences are visible to everyone" on experiences
for select to anon, authenticated
using (true);

create policy "Authenticated users can create experiences" on experiences
for insert to authenticated
with check (auth.uid() = user_id);

create policy "Authenticated users can update their own experiences" on experiences
for update to authenticated
using (auth.uid() = user_id);

create policy "Authenticated users can delete their own experiences" on experiences
for delete to authenticated
using (auth.uid() = user_id);
