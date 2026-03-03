-- Stripe Escrow Schema Updates

-- 1. Add Stripe fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_account_id text,
ADD COLUMN IF NOT EXISTS stripe_onboarded boolean DEFAULT false;

-- 2. Add custom booking status enum
-- (If it already exists, you can skip creating it, or we can just use text constraints instead to avoid enum issues)
-- We will just use text fields with check constraints for simplicity to not break existing data.

-- 3. Modify bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS platform_fee numeric(10,2),
ADD COLUMN IF NOT EXISTS host_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS grace_period_end_time timestamp with time zone;

-- Make sure status can be 'authorized', 'captured', 'canceled', 'refunded', 'pending_payment', 'completed'
-- Existing values might be 'paid', 'pending', etc. Update current values to maintain integrity if needed.

-- Optional: RLS policies for Host viewing and updating their own bookings
-- (Assumes you have a way to identify if a user is the host of an experience)

CREATE OR REPLACE FUNCTION update_grace_period()
RETURNS trigger AS $$
BEGIN
  -- Set grace period to 24 hours after check_out if it exists, else check_in
  IF NEW.check_out IS NOT NULL THEN
    NEW.grace_period_end_time := NEW.check_out + INTERVAL '24 hours';
  ELSIF NEW.check_in IS NOT NULL THEN
    NEW.grace_period_end_time := NEW.check_in + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_grace_period ON public.bookings;
CREATE TRIGGER set_grace_period
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION update_grace_period();
