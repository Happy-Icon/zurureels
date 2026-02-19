-- Allow Hosts to view bookings for their experiences
create policy "Hosts can view bookings for their experiences" on bookings
for select
using (
  exists (
    select 1 from experiences
    where experiences.id = bookings.experience_id
    and experiences.user_id = auth.uid()
  )
);

-- Allow Hosts to update status (approve/decline)
create policy "Hosts can update bookings for their experiences" on bookings
for update
using (
  exists (
    select 1 from experiences
    where experiences.id = bookings.experience_id
    and experiences.user_id = auth.uid()
  )
);

-- Add Foreign Key to Profiles for easier joining
-- This assumes profiles.id is the same as auth.users.id (which it is)
alter table bookings
add constraint bookings_user_id_fkey_profiles
foreign key (user_id)
references profiles(id);
