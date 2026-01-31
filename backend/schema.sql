-- Database Schema for ZuruReels

-- 1. PROFILES
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text default 'guest',
  full_name text,
  phone text,
  languages text[] DEFAULT '{}',
  verification_badges jsonb DEFAULT '{"email": false, "phone": false, "identity": false}'::jsonb,
  emergency_contact jsonb DEFAULT '{"name": "", "phone": "", "relationship": ""}'::jsonb,
  profile_completeness integer DEFAULT 20,
  security_settings jsonb DEFAULT '{"two_factor": false, "login_alerts": true, "sms_notifications": false}'::jsonb,
  notification_settings jsonb DEFAULT '{"channels": {"email": true, "sms": true, "push": true, "whatsapp": false}, "trips": {"bookings": true, "checkin": true, "messages": true}, "security": {"login": true, "password": true}, "marketing": {"price_drops": false, "recommendations": true, "newsletter": true, "frequency": "weekly"}}'::jsonb,
  metadata jsonb
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- 2. PAYMENT METHODS
create table payment_methods (
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
create policy "Users can view own methods" on payment_methods for select using (auth.uid() = user_id);
create policy "Users can add own methods" on payment_methods for insert with check (auth.uid() = user_id);

-- 3. BOOKINGS
create table bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  trip_title text not null,
  amount numeric not null,
  status text default 'pending', -- pending, paid, cancelled
  payment_reference text,
  created_at timestamp with time zone default now() not null
);
alter table bookings enable row level security;
create policy "Users can view own bookings" on bookings for select using (auth.uid() = user_id);
create policy "Users can insert own bookings" on bookings for insert with check (auth.uid() = user_id);

-- 4. EXPERIENCES
create table experiences (
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
create index idx_experiences_category on experiences(category);
create index idx_experiences_location on experiences(location);
create index idx_experiences_user_id on experiences(user_id);

alter table experiences enable row level security;

-- Policies for public (anon) and authenticated users
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
