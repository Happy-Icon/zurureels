-- Create events table for CityPulse
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  location text not null,
  event_date timestamp with time zone not null,
  end_date timestamp with time zone,
  image_url text,
  price numeric default 0,
  attendees integer default 0,
  status text default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add RLS policies
alter table events enable row level security;

-- Everyone can view active events
create policy "Events are viewable by everyone"
  on events for select
  using (status = 'active');

-- Users can create events
create policy "Users can create events"
  on events for insert
  with check (auth.uid() = user_id);

-- Users can update own events
create policy "Users can update own events"
  on events for update
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_events_location on events(location);
create index if not exists idx_events_category on events(category);
create index if not exists idx_events_date on events(event_date);
create index if not exists idx_events_status on events(status);
