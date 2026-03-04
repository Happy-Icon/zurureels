-- Migration: Add Cloudinary columns to reels table for video optimization
alter table reels
  add column if not exists cloudinary_public_id text,
  add column if not exists cloudinary_secure_url text;

comment on column reels.cloudinary_public_id is 'Cloudinary public_id for optimized video/image retrieval';
comment on column reels.cloudinary_secure_url is 'Cloudinary secure_url for direct access to media';
