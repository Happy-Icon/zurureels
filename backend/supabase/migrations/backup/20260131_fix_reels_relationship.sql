
-- Fix missing relationship for PostgREST embedding
-- The frontend is asking for host:profiles(...) but reels.user_id only references auth.users
-- We add a second foreign key to public.profiles to allow this generic relationship.

alter table reels
add constraint reels_user_id_profiles_fkey
foreign key (user_id)
references profiles(id)
on delete cascade;
