-- Host Calendar Availability & Blocked Dates Migration

-- 1. Create host_blocked_dates table
CREATE TABLE IF NOT EXISTS public.host_blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT DEFAULT 'Personal use',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CHECK (end_date > start_date)
);

-- Index for date range overlap queries
CREATE INDEX IF NOT EXISTS host_blocked_dates_exp_dates_idx
  ON public.host_blocked_dates (experience_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS host_blocked_dates_host_idx
  ON public.host_blocked_dates (host_id);

-- RLS Policies
ALTER TABLE public.host_blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can manage their own blocked dates" ON public.host_blocked_dates;
CREATE POLICY "Hosts can manage their own blocked dates"
  ON public.host_blocked_dates FOR ALL TO authenticated
  USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Public can view blocked dates for availability check" ON public.host_blocked_dates;
CREATE POLICY "Public can view blocked dates for availability check"
  ON public.host_blocked_dates FOR SELECT TO anon, authenticated
  USING (true);

-- 2. RPC: Block Host Dates with Server-Side Conflict Protection
CREATE OR REPLACE FUNCTION public.block_host_dates(
  p_experience_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT DEFAULT 'Personal use'
)
RETURNS public.host_blocked_dates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID := auth.uid();
  v_has_conflict BOOLEAN;
  v_new_block public.host_blocked_dates%ROWTYPE;
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'Invalid date range. End date must be after start date.' USING ERRCODE = '22023';
  END IF;

  -- Verify host owns the experience
  IF NOT EXISTS (
    SELECT 1 FROM public.experiences WHERE id = p_experience_id AND user_id = v_host_id
  ) THEN
    RAISE EXCEPTION 'Listing not found or permission denied' USING ERRCODE = '42501';
  END IF;

  -- Conflict Protection: Ensure no confirmed or pending reservations overlap with requested block
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.experience_id = p_experience_id
      AND COALESCE(b.status, 'pending') NOT IN ('cancelled', 'refunded', 'failed')
      AND (b.check_in::DATE) < p_end_date
      AND (b.check_out::DATE) > p_start_date
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RAISE EXCEPTION 'Dates contain active or pending reservations and cannot be blocked.' USING ERRCODE = 'P0001';
  END IF;

  -- Insert the new blocked range
  INSERT INTO public.host_blocked_dates (
    experience_id,
    host_id,
    start_date,
    end_date,
    reason
  ) VALUES (
    p_experience_id,
    v_host_id,
    p_start_date,
    p_end_date,
    COALESCE(p_reason, 'Personal use')
  ) RETURNING * INTO v_new_block;

  RETURN v_new_block;
END;
$$;

-- 3. RPC: Unblock Host Dates
CREATE OR REPLACE FUNCTION public.unblock_host_dates(
  p_block_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID := auth.uid();
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.host_blocked_dates
  WHERE id = p_block_id AND host_id = v_host_id;

  RETURN FOUND;
END;
$$;
