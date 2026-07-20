-- Update profiles table with Digital Identity fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS verification_badges jsonb DEFAULT '{"email": false, "phone": false, "identity": false}'::jsonb,
ADD COLUMN IF NOT EXISTS emergency_contact jsonb DEFAULT '{"name": "", "phone": "", "relationship": ""}'::jsonb,
ADD COLUMN IF NOT EXISTS profile_completeness integer DEFAULT 20;

COMMENT ON COLUMN profiles.languages IS 'Array of languages spoken by the user';
COMMENT ON COLUMN profiles.verification_badges IS 'Status of various verification checks';
COMMENT ON COLUMN profiles.emergency_contact IS 'Emergency contact details';
COMMENT ON COLUMN profiles.profile_completeness IS 'Calculated profile completion percentage';
