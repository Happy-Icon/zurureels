-- Fix RLS policy to allow users to insert/upsert their own profile
-- This is necessary for users who existed before the trigger was created, 
-- or if the client uses 'upsert' which requires INSERT permissions.

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Ensure the update policy is correct (it looked okay, but reinforcing)
-- The existing one was: create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
-- That is sufficient for UPDATE.

-- Grant usage on sequence is usually not needed for UUID PKs, but good to be safe if there were serials (not here).
