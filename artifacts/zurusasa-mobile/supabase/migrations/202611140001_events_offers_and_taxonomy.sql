-- =============================================================================
-- Migration: 202611140001_events_offers_and_taxonomy.sql
-- Description: Align ZuruSasa taxonomy (4 primary experience categories +
--              subcategories), Events linking/expiry, and Special Offers table.
-- =============================================================================

-- 1. EXTEND EXPERIENCES TABLE WITH SUBCATEGORY, HOURS & PROMOTIONAL TAGS
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS promotional_tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS operating_hours text;

-- 2. ENSURE / EXTEND EVENTS TABLE WITH ESTABLISHMENT LINK & EXPIRY FIELDS
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  location text,
  event_date timestamptz,
  end_date timestamptz,
  price numeric DEFAULT 0,
  image_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS experience_id uuid REFERENCES public.experiences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organizer_name text,
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS entry_conditions text,
  ADD COLUMN IF NOT EXISTS booking_instructions text,
  ADD COLUMN IF NOT EXISTS ticket_link text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 3. CREATE SPECIAL OFFERS TABLE
CREATE TABLE IF NOT EXISTS public.special_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_id uuid REFERENCES public.experiences(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  offer_type text NOT NULL DEFAULT 'happy_hour',
  discount_label text NOT NULL DEFAULT 'Special Offer',
  original_price numeric,
  offer_price numeric,
  applicable_schedule text,
  terms_conditions text,
  redemption_instructions text,
  image_url text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'inactive', 'draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies for special_offers
ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active special offers" ON public.special_offers;
CREATE POLICY "Public can view active special offers"
  ON public.special_offers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Hosts can insert own special offers" ON public.special_offers;
CREATE POLICY "Hosts can insert own special offers"
  ON public.special_offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hosts can update own special offers" ON public.special_offers;
CREATE POLICY "Hosts can update own special offers"
  ON public.special_offers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hosts can delete own special offers" ON public.special_offers;
CREATE POLICY "Hosts can delete own special offers"
  ON public.special_offers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.special_offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.special_offers TO authenticated;

-- 4. EXTEND REELS WITH PUBLISHING CONTENT TYPE, SUBCATEGORY, EVENT & OFFER LINKS
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'experience',
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.special_offers(id) ON DELETE SET NULL;

-- Backfill content_type for existing event reels
UPDATE public.reels
SET content_type = 'event'
WHERE lower(coalesce(category, '')) IN ('event', 'events')
  AND content_type = 'experience';

-- 5. INDEXES FOR FAST DISCOVERY & AUTO-EXPIRY QUERIES
CREATE INDEX IF NOT EXISTS idx_reels_content_type ON public.reels(content_type);
CREATE INDEX IF NOT EXISTS idx_experiences_category_subcategory ON public.experiences(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_events_date_status ON public.events(event_date, status);
CREATE INDEX IF NOT EXISTS idx_special_offers_expiry_status ON public.special_offers(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_special_offers_experience_id ON public.special_offers(experience_id);
