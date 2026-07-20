-- SQL Migration: ZuruSasa Host Daily Statuses
-- Creates host_statuses table with 24-hour expiration and RLS policies

CREATE TABLE IF NOT EXISTS public.host_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('text', 'image', 'video')),
    media_url TEXT, -- null for text status
    text_content TEXT, -- null for image/video status
    background_gradient TEXT, -- preset background gradient name or CSS gradient
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours') NOT NULL
);

-- Enable RLS
ALTER TABLE public.host_statuses ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Select policy: Anyone can view active (non-expired) statuses
DROP POLICY IF EXISTS "Anyone can view active host statuses" ON public.host_statuses;
CREATE POLICY "Anyone can view active host statuses" 
ON public.host_statuses FOR SELECT 
USING (expires_at > now());

-- 2. Insert policy: Hosts can insert their own status
DROP POLICY IF EXISTS "Hosts can insert their own status" ON public.host_statuses;
CREATE POLICY "Hosts can insert their own status" 
ON public.host_statuses FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Update policy: Hosts can update their own status
DROP POLICY IF EXISTS "Hosts can update their own status" ON public.host_statuses;
CREATE POLICY "Hosts can update their own status" 
ON public.host_statuses FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Delete policy: Hosts can delete their own status
DROP POLICY IF EXISTS "Hosts can delete their own status" ON public.host_statuses;
CREATE POLICY "Hosts can delete their own status" 
ON public.host_statuses FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS host_statuses_user_id_idx ON public.host_statuses(user_id);
CREATE INDEX IF NOT EXISTS host_statuses_expires_at_idx ON public.host_statuses(expires_at);

-- Ensure profiles table has the bio column (compatibility with master migration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

