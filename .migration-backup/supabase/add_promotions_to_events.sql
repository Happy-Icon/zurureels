-- Migration: Add Promotion & Paystack Billing Columns to Events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS promotion_type TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paystack_reference TEXT;

-- Add check constraint to ensure only valid promotion types are allowed
ALTER TABLE events
DROP CONSTRAINT IF EXISTS check_promotion_type,
ADD CONSTRAINT check_promotion_type 
CHECK (promotion_type IN ('free', 'boosted', 'pinned'));

-- Comment for documentation
COMMENT ON COLUMN events.promotion_type IS 'The promotion status of the event stream: free, boosted, or pinned';
COMMENT ON COLUMN events.is_paid IS 'Indicates if the event promotion fee has been successfully paid';
COMMENT ON COLUMN events.paystack_reference IS 'Transaction reference from Paystack checkout confirmation';
