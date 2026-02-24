-- Add Cloudinary public ID column to reels table
-- This stores the Cloudinary public_id so the frontend CloudinaryVideo
-- component can build optimized, transformed URLs via the CDN.
-- The original video_url column is kept for backward compatibility with
-- any existing rows uploaded to Supabase Storage.

alter table reels
  add column if not exists cloudinary_public_id text,
  add column if not exists cloudinary_secure_url text;

-- Index for any future queries that filter on Cloudinary assets
create index if not exists idx_reels_cloudinary_public_id
  on reels(cloudinary_public_id)
  where cloudinary_public_id is not null;
