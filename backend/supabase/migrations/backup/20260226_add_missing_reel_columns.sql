-- Add missing columns to reels table to support processing states and optimized playback
-- These columns were found missing on the main branch while being expected by some code versions.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reels' AND column_name = 'processing_status') THEN
        ALTER TABLE reels ADD COLUMN processing_status text DEFAULT 'active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reels' AND column_name = 'processed_video_url') THEN
        ALTER TABLE reels ADD COLUMN processed_video_url text;
    END IF;
END $$;

-- Specifically for the error reported: ensure the system matches what the 'schema cache' thinks it should see.
-- The error "Could not find processing_status column" usually implies an RPC, Trigger, or PostgREST cache issue.
-- Adding the column directly is the first step to resolution.
