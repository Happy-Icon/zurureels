-- Refined Storage Setup for Zuru Reels
-- Handles 'reels' and 'avatars' buckets with production RLS

-- 1. Buckets
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2. REELS Policies
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'reels' OR bucket_id = 'avatars' );

drop policy if exists "Authenticated users can upload reels" on storage.objects;
create policy "Authenticated users can upload reels"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'reels' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own reels" on storage.objects;
create policy "Users can update their own reels"
on storage.objects for update
to authenticated
using ( bucket_id = 'reels' AND owner = auth.uid() );

drop policy if exists "Users can delete their own reels" on storage.objects;
create policy "Users can delete their own reels"
on storage.objects for delete
to authenticated
using ( bucket_id = 'reels' AND owner = auth.uid() );

-- 3. AVATARS Policies
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
on storage.objects for update
to authenticated
using ( bucket_id = 'avatars' AND owner = auth.uid() );
