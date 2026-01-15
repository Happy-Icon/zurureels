-- Database Schema for ZuruReels

-- 1. PROFILES
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  phone text,
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
