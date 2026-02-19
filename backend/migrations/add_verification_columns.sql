-- Add Verification Columns to Profiles Table

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS verification_id text;

-- Optional: Create an index for faster lookups if needed later
-- CREATE INDEX IF NOT EXISTS profiles_verification_status_idx ON public.profiles(verification_status);
