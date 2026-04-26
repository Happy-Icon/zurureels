-- Ensure the reels storage bucket is public and has appropriate RLS policies for ZuruReels

-- 1. Create the bucket if it doesn't exist and set it to public
INSERT INTO storage.buckets (id, name, public)
VALUES ('reels', 'reels', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Allow public read access to the reels bucket
-- This policy allows anyone (even anonymous users) to view reels
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'reels');

-- 3. Allow authenticated users to upload their own reels
-- This policy ensures users can only upload files to the reels bucket
-- and ideally we'd want to check if they own the related experience, but storage policies are simpler
DROP POLICY IF EXISTS "Users can upload reels" ON storage.objects;
CREATE POLICY "Users can upload reels" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reels');

-- 4. Allow users to delete their own reels
DROP POLICY IF EXISTS "Users can delete their own reels" ON storage.objects;
CREATE POLICY "Users can delete their own reels" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'reels' AND auth.uid() = owner);
