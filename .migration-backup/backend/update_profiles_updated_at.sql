-- Add updated_at column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

COMMENT ON COLUMN profiles.updated_at IS 'Timestamp of the last profile update';
