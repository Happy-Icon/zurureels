-- RUN THIS TO UNSTICK YOUR ACCOUNT (CORRECTED)
-- The valid status is 'none', not 'unverified'

UPDATE profiles
SET 
  verification_status = 'none',
  verification_id = NULL
WHERE email = 'angeloulak2004@gmail.com'; 

-- Verify the change
SELECT email, verification_status FROM profiles WHERE email = 'angeloulak2004@gmail.com';
