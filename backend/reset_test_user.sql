-- SQL Commands to Reset a User for Testing
-- Replace 'USER_ID_HERE' with the actual user UUID you want to reset

-- STEP 0: First run add_shufti_status_column.sql if you haven't already!

-- Option 1: Just reset verification status (keeps the user account, role stays 'host')
-- Result: Button shows "Complete Verification"
UPDATE profiles 
SET 
    verification_status = 'none',
    verification_id = NULL,
    stripe_account_id = NULL,
    stripe_onboarded = false
WHERE id = 'USER_ID_HERE';

-- Also reset shufti_status if the column exists (ignore error if it doesn't)
-- UPDATE profiles SET shufti_status = 'none' WHERE id = 'USER_ID_HERE';

-- Option 1b: Reset verification AND role (to fully restart from "Become a Host")
-- Result: Button shows "Become a Host"
UPDATE profiles 
SET 
    role = 'guest',
    verification_status = 'none',
    verification_id = NULL,
    stripe_account_id = NULL,
    stripe_onboarded = false,
    business_name = NULL,
    id_number = NULL
WHERE id = 'USER_ID_HERE';

-- Also reset shufti_status if the column exists (ignore error if it doesn't)
-- UPDATE profiles SET shufti_status = 'none' WHERE id = 'USER_ID_HERE';

-- Option 2: Delete user data from profiles (keeps auth user)
-- DELETE FROM profiles WHERE id = 'USER_ID_HERE';

-- Option 3: Full user deletion (requires admin privileges)
-- This needs to be done via Supabase Dashboard or Auth Admin API
-- Go to: Supabase Dashboard > Authentication > Users > Find user > Delete

-- Check current status:
-- SELECT id, email, verification_status, shufti_status, stripe_account_id, stripe_onboarded 
-- FROM profiles 
-- WHERE id = 'USER_ID_HERE';

-- Reset all test users (use with caution!):
-- UPDATE profiles 
-- SET 
--     verification_status = 'none',
--     shufti_status = 'none',
--     verification_id = NULL,
--     stripe_account_id = NULL,
--     stripe_onboarded = false
-- WHERE verification_status = 'verified';