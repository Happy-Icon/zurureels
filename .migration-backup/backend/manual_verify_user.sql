-- Manually verify a user for testing (when webhook fails)
-- Replace USER_ID with the actual user ID

-- Set verification status to verified
UPDATE profiles 
SET 
    verification_status = 'verified',
    shufti_status = 'verified'
WHERE id = '07150556-5c7e-4bdf-b146-4611ce8c9929';

-- Verify it worked
SELECT id, email, verification_status, shufti_status 
FROM profiles 
WHERE id = '07150556-5c7e-4bdf-b146-4611ce8c9929';