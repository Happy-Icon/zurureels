-- Add host-specific fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS id_number text,
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS host_role text DEFAULT 'guest';

-- Add check constraint for verification_status to ensure data integrity
ALTER TABLE profiles 
ADD CONSTRAINT check_verification_status 
CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));
