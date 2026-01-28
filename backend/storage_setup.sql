-- Create the 'reels' storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do nothing;

-- Allow public access to read reels
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'reels' );

-- Allow authenticated users to upload their own reels
drop policy if exists "Authenticated users can upload reels" on storage.objects;
create policy "Authenticated users can upload reels"
on storage.objects for insert
with check (
  bucket_id = 'reels' AND
  auth.role() = 'authenticated'
);

-- Allow users to delete their own reels
drop policy if exists "Users can delete their own reels" on storage.objects;
create policy "Users can delete their own reels"
on storage.objects for delete
using (
  bucket_id = 'reels' AND
  auth.uid() = owner
);
