-- Add shufti_status column to profiles table
-- This aligns with verification_status for consistency

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS shufti_status text DEFAULT 'none';

-- Set initial values based on existing verification_status
UPDATE profiles 
SET shufti_status = verification_status 
WHERE shufti_status = 'none' AND verification_status IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('verification_status', 'shufti_status', 'stripe_account_id', 'stripe_onboarded');