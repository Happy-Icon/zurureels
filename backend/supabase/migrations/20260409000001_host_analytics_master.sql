-- ==========================================
-- MASTER MIGRATION: HOST ANALYTICS
-- Tracking views, engagement, and KPIs
-- ==========================================

-- 1. Create reel_views table to track impressions
CREATE TABLE IF NOT EXISTS public.reel_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT, -- Fallback for anonymous users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reel_views_reel_id ON public.reel_views(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_views_created_at ON public.reel_views(created_at);

-- RLS
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to record a view
DROP POLICY IF EXISTS "Anyone can insert views" ON public.reel_views;
CREATE POLICY "Anyone can insert views" ON public.reel_views 
FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow hosts to read views on their own reels
DROP POLICY IF EXISTS "Hosts can read views on their reels" ON public.reel_views;
CREATE POLICY "Hosts can read views on their reels" ON public.reel_views 
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.reels WHERE id = reel_views.reel_id AND user_id = auth.uid())
);

-- 2. Create reel_shares table to track shares
CREATE TABLE IF NOT EXISTS public.reel_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    platform TEXT, -- e.g., 'whatsapp', 'twitter', 'copy_link'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reel_shares_reel_id ON public.reel_shares(reel_id);
ALTER TABLE public.reel_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert shares" ON public.reel_shares;
CREATE POLICY "Anyone can insert shares" ON public.reel_shares 
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Hosts can read shares on their reels" ON public.reel_shares;
CREATE POLICY "Hosts can read shares on their reels" ON public.reel_shares 
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.reels WHERE id = reel_shares.reel_id AND user_id = auth.uid())
);

-- 3. Create host_profile_views table
CREATE TABLE IF NOT EXISTS public.host_profile_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    viewer_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_host_profile_views_host_id ON public.host_profile_views(host_id);
ALTER TABLE public.host_profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert profile views" ON public.host_profile_views;
CREATE POLICY "Anyone can insert profile views" ON public.host_profile_views 
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Hosts can read their own profile views" ON public.host_profile_views;
CREATE POLICY "Hosts can read their own profile views" ON public.host_profile_views 
FOR SELECT TO authenticated USING (host_id = auth.uid());


-- 4. RPC to get daily stats for a host (used for the charts)
CREATE OR REPLACE FUNCTION public.get_host_daily_stats(host_uuid UUID, days_back INT DEFAULT 30)
RETURNS TABLE (
    date DATE,
    views BIGINT,
    likes BIGINT,
    saves BIGINT,
    bookings BIGINT,
    shares BIGINT,
    followers BIGINT,
    profile_views BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT (current_date - i) AS d
        FROM generate_series(0, days_back - 1) i
    )
    SELECT
        ds.d AS date,
        COUNT(DISTINCT v.id) AS views,
        COUNT(DISTINCT l.id) AS likes,
        COUNT(DISTINCT s.id) AS saves,
        COUNT(DISTINCT b.id) AS bookings,
        COUNT(DISTINCT sh.id) AS shares,
        COUNT(DISTINCT f.id) AS followers,
        COUNT(DISTINCT pv.id) AS profile_views
    FROM date_series ds
    LEFT JOIN public.reels r ON r.user_id = host_uuid
    LEFT JOIN public.reel_views v ON v.reel_id = r.id AND DATE(v.created_at) = ds.d
    LEFT JOIN public.reel_likes l ON l.reel_id = r.id AND DATE(l.created_at) = ds.d
    LEFT JOIN public.reel_saves s ON s.reel_id = r.id AND DATE(s.created_at) = ds.d
    LEFT JOIN public.reel_shares sh ON sh.reel_id = r.id AND DATE(sh.created_at) = ds.d
    LEFT JOIN public.experiences e ON e.user_id = host_uuid
    LEFT JOIN public.bookings b ON b.experience_id = e.id AND DATE(b.created_at) = ds.d
    LEFT JOIN public.user_follows f ON f.following_id = host_uuid AND DATE(f.created_at) = ds.d
    LEFT JOIN public.host_profile_views pv ON pv.host_id = host_uuid AND DATE(pv.created_at) = ds.d
    GROUP BY ds.d
    ORDER BY ds.d ASC;
END;
$$;
-- 16. Unified Search Function
CREATE OR REPLACE FUNCTION public.unified_search(search_query TEXT)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    subtitle TEXT,
    image_url TEXT,
    metadata JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    -- 1. Experiences (Reels/Listings)
    SELECT 
        e.id, 
        'experience'::TEXT as type, 
        e.title, 
        e.location as subtitle,
        e.image_url,
        jsonb_build_object('category', e.category, 'price', e.current_price, 'entity_name', e.entity_name) as metadata
    FROM experiences e
    WHERE e.title ILIKE '%' || search_query || '%' 
       OR e.location ILIKE '%' || search_query || '%'
       OR e.category::TEXT ILIKE '%' || search_query || '%'
       OR e.entity_name ILIKE '%' || search_query || '%'
    
    UNION ALL
    
    -- 2. Profiles (Hosts/Users)
    SELECT 
        p.id, 
        'profile'::TEXT as type, 
        p.full_name as title, 
        '@' || COALESCE(p.username, 'user') as subtitle,
        p.metadata->>'avatar_url' as image_url,
        jsonb_build_object('bio', p.bio) as metadata
    FROM profiles p
    WHERE p.full_name ILIKE '%' || search_query || '%' 
       OR p.username ILIKE '%' || search_query || '%'
    
    UNION ALL
    
    -- 3. Events
    SELECT 
        ev.id, 
        'event'::TEXT as type, 
        ev.title, 
        ev.location as subtitle,
        ev.image_url,
        jsonb_build_object('date', ev.event_date) as metadata
    FROM events ev
    WHERE ev.title ILIKE '%' || search_query || '%' 
       OR ev.location ILIKE '%' || search_query || '%'
    
    LIMIT 20;
END;
$$;
