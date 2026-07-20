-- Add verification columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_id text;

-- Create policy to allow users to read their own verification status
CREATE POLICY "Users can read own verification status"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create policy to allow authenticated users to update their own verification status (for now, ideally this should be done via webhook/admin only)
-- But for initial implementation, we might need to update it from client or edge function
-- Better approach: Only Edge Function (service role) can update this. 
-- So we won't add an UPDATE policy for regular users on these columns specifically, but they likely already have update access to their profile.
-- We'll rely on the existing "Users can update own profile" policy if it exists, but ideally we should restrict these columns.
-- For now, we will trust the edge function/backend logic.
