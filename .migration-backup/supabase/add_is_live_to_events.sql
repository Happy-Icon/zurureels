-- Alter the events table to add live streaming fields
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS live_stream_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS notification_intervals JSONB DEFAULT '["24h", "1h"]'::JSONB;

-- Comments explaining the new columns
COMMENT ON COLUMN public.events.is_live IS 'True if the host is currently streaming this event live';
COMMENT ON COLUMN public.events.live_stream_url IS 'The HLS stream URL output from Cloudinary or placeholder indicator';
COMMENT ON COLUMN public.events.viewer_count IS 'The active count of users watching the live stream';
