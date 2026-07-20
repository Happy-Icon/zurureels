-- Add verification columns to reels table
alter table reels 
add column if not exists lat numeric,
add column if not exists lng numeric,
add column if not exists is_live boolean default false,
add column if not exists verified_at timestamp with time zone;

-- Update RLS if necessary (currently public read is fine)
comment on column reels.lat is 'Latitude captured during verified live recording';
comment on column reels.lng is 'Longitude captured during verified live recording';
comment on column reels.is_live is 'True if the reel was recorded live in the app, preventing gallery uploads';
