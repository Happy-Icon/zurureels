-- Inspect the check constraint on profiles table
SELECT 
    conname as constraint_name, 
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c 
JOIN pg_namespace n ON n.oid = c.connamespace 
WHERE conname = 'check_verification_status';

-- Also check if it's an enum type
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'verification_status_enum';
