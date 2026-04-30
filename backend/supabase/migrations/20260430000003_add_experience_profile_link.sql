-- Fix for Experiences-Profiles relationship
-- Enables PostgREST to perform joins between experiences and host profiles

-- 1. Add Explicit Foreign Key for PostgREST
ALTER TABLE public.experiences 
DROP CONSTRAINT IF EXISTS experiences_user_id_profiles_fkey;

ALTER TABLE public.experiences 
ADD CONSTRAINT experiences_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Add Index for Performance
CREATE INDEX IF NOT EXISTS idx_experiences_user_id ON public.experiences(user_id);
