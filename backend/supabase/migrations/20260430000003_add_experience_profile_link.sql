-- Fix for Experiences-Profiles relationship and missing Profile columns
-- Enables PostgREST to perform joins and fixes undefined column errors

-- 1. Ensure Profile columns exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Add Explicit Foreign Key for PostgREST
ALTER TABLE public.experiences 
DROP CONSTRAINT IF EXISTS experiences_user_id_profiles_fkey;

ALTER TABLE public.experiences 
ADD CONSTRAINT experiences_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 3. Add Index for Performance
CREATE INDEX IF NOT EXISTS idx_experiences_user_id ON public.experiences(user_id);
