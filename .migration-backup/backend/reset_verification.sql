-- Reset Verification Status
-- Run this if you are stuck in "Pending" state

UPDATE public.profiles
SET verification_status = 'unverified'
WHERE verification_status = 'pending';
