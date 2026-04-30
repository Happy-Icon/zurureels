-- Host Rating System Implementation
-- Implements the host_reviews table and updates profiles to cache ratings

-- 1. Create Host Reviews Table
CREATE TABLE IF NOT EXISTS public.host_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(host_id, reviewer_id)
);

-- 2. Add Rating Cache Columns to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 3. Trigger Function to Update Profile Rating Cache
CREATE OR REPLACE FUNCTION public.update_profile_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        UPDATE public.profiles
        SET 
            rating = (
                SELECT COALESCE(AVG(rating), 0) 
                FROM public.host_reviews 
                WHERE host_id = COALESCE(NEW.host_id, OLD.host_id)
            ),
            review_count = (
                SELECT COUNT(*) 
                FROM public.host_reviews 
                WHERE host_id = COALESCE(NEW.host_id, OLD.host_id)
            )
        WHERE id = COALESCE(NEW.host_id, OLD.host_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS on_review_change ON public.host_reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.host_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_profile_rating_stats();

-- 5. Enable RLS
ALTER TABLE public.host_reviews ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "Anyone can view host reviews" ON public.host_reviews;
CREATE POLICY "Anyone can view host reviews" 
ON public.host_reviews FOR SELECT 
TO PUBLIC 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.host_reviews;
CREATE POLICY "Authenticated users can create reviews" 
ON public.host_reviews FOR INSERT 
TO AUTHENTICATED 
WITH CHECK (auth.uid() = reviewer_id AND auth.uid() <> host_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.host_reviews;
CREATE POLICY "Users can update their own reviews" 
ON public.host_reviews FOR UPDATE 
TO AUTHENTICATED 
USING (auth.uid() = reviewer_id);
