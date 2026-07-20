-- Migration: Add Digital Identity columns to profiles table

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS verification_badges jsonb DEFAULT '{"email": false, "phone": false, "identity": false}'::jsonb,
ADD COLUMN IF NOT EXISTS emergency_contact jsonb DEFAULT '{"name": "", "phone": "", "relationship": ""}'::jsonb,
ADD COLUMN IF NOT EXISTS profile_completeness integer DEFAULT 20;

-- Comment on columns
COMMENT ON COLUMN profiles.languages IS 'Array of languages spoken by the user';
COMMENT ON COLUMN profiles.verification_badges IS 'Status of various verification steps';
COMMENT ON COLUMN profiles.emergency_contact IS 'Emergency contact details';
