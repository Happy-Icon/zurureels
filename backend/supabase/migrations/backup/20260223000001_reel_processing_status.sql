-- Add processing status to reels
alter table reels 
add column if not exists processing_status text default 'ready' check (processing_status in ('uploading', 'processing', 'ready', 'failed')),
add column if not exists processed_video_url text;

-- Update existing reels to 'ready'
update reels set processing_status = 'ready' where processing_status is null;
