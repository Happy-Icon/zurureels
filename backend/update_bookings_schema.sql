-- Upgrade Bookings Table for Production
alter table bookings 
add column if not exists experience_id uuid references experiences(id),
add column if not exists check_in timestamp with time zone,
add column if not exists check_out timestamp with time zone,
add column if not exists guests integer default 1,
add column if not exists updated_at timestamp with time zone default now();

-- Update constraints
comment on column bookings.experience_id is 'Link to the specific listing being booked';
comment on column bookings.check_in is 'Scheduled start date/time';
comment on column bookings.check_out is 'Scheduled end date/time';

-- Add indexes for performance
create index if not exists idx_bookings_experience_id on bookings(experience_id);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_dates on bookings(check_in, check_out);
