alter table reels
  add column if not exists cloudinary_public_id text,
  add column if not exists cloudinary_secure_url text;

comment on column reels.cloudinary_public_id is 'Cloudinary public_id for optimized video/image retrieval';
comment on column reels.cloudinary_secure_url is 'Cloudinary secure_url for direct access to media';

-- Performance indexes for fast reel loading
CREATE INDEX IF NOT EXISTS idx_reels_category ON reels(category);
CREATE INDEX IF NOT EXISTS idx_reels_is_live ON reels(is_live);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at);

