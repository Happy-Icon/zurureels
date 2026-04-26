-- ==========================================
-- ZURUSASA MASTER MIGRATION
-- Consolidating Core Platform Infrastructure
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  full_name TEXT,
  username TEXT,
  phone TEXT,
  bio TEXT,
  business_name TEXT,
  id_number TEXT,
  verification_status TEXT DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected')),
  host_role TEXT DEFAULT 'guest',
  stripe_account_id TEXT,
  stripe_onboarded BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. EXPERIENCES
CREATE TABLE IF NOT EXISTS public.experiences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    category TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    image_url TEXT,
    base_price NUMERIC,
    current_price NUMERIC NOT NULL,
    price_unit TEXT DEFAULT 'person',
    availability_status TEXT DEFAULT 'available',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public experiences are visible to everyone" ON public.experiences;
CREATE POLICY "Public experiences are visible to everyone" ON public.experiences FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage own experiences" ON public.experiences;
CREATE POLICY "Authenticated users can manage own experiences" ON public.experiences FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4. REELS
CREATE TABLE IF NOT EXISTS public.reels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    experience_id UUID REFERENCES public.experiences(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    category TEXT,
    caption TEXT,
    status TEXT DEFAULT 'active',
    processing_status TEXT DEFAULT 'pending',
    processed_video_url TEXT,
    cloudinary_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    is_live BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view reels" ON public.reels;
CREATE POLICY "Anyone can view reels" ON public.reels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Hosts can manage own reels" ON public.reels;
CREATE POLICY "Hosts can manage own reels" ON public.reels FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4.1 STORAGE SETUP (Reels Bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reels', 'reels', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'reels');

DROP POLICY IF EXISTS "Users can upload reels" ON storage.objects;
CREATE POLICY "Users can upload reels" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reels');

DROP POLICY IF EXISTS "Users can delete their own reels" ON storage.objects;
CREATE POLICY "Users can delete their own reels" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'reels' AND auth.uid() = owner);

-- 5. BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    experience_id UUID REFERENCES public.experiences(id),
    reel_id UUID REFERENCES public.reels(id),
    trip_title TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_reference TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Hosts can view bookings for their experiences" ON public.bookings;
CREATE POLICY "Hosts can view bookings for their experiences" ON public.bookings FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = bookings.experience_id AND e.user_id = auth.uid()));

-- 6. INTERACTIONS (Likes, Saves, Follows)
CREATE TABLE IF NOT EXISTS public.reel_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, reel_id)
);

CREATE TABLE IF NOT EXISTS public.reel_saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, reel_id)
);

CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) NOT NULL,
  following_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes visible to all" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "Users can manage likes" ON public.reel_likes FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage saves" ON public.reel_saves FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Follows visible to all" ON public.user_follows FOR SELECT USING (true);
CREATE POLICY "Users can manage follows" ON public.user_follows FOR ALL TO authenticated USING (auth.uid() = follower_id);

-- 7. NOTIFICATIONS & DEVICES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    device_token TEXT NOT NULL,
    platform TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, device_token)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own devices" ON public.user_devices FOR ALL USING (auth.uid() = user_id);

-- 8. ANALYTICS TABLES
CREATE TABLE IF NOT EXISTS public.reel_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reel_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    sharer_id UUID REFERENCES auth.users(id),
    platform TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.host_profile_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. FUNCTIONS & TRIGGERS
-- Profile Sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, username, metadata)
    VALUES (
        new.id,
        COALESCE(new.raw_user_metadata->>'full_name', new.raw_user_metadata->>'name'),
        COALESCE(new.raw_user_metadata->>'username', SPLIT_PART(new.email, '@', 1)),
        jsonb_build_object(
            'avatar_url', new.raw_user_metadata->>'avatar_url',
            'email', new.email
        )
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        metadata = profiles.metadata || EXCLUDED.metadata;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Unified Search
CREATE OR REPLACE FUNCTION public.unified_search(search_query TEXT)
RETURNS TABLE (id UUID, type TEXT, title TEXT, subtitle TEXT, image_url TEXT, metadata JSONB) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, 'experience'::TEXT, e.title, e.location, e.image_url, 
           jsonb_build_object('category', e.category, 'price', e.current_price, 'entity_name', e.entity_name)
    FROM experiences e WHERE e.title ILIKE '%' || search_query || '%' OR e.location ILIKE '%' || search_query || '%'
    UNION ALL
    SELECT p.id, 'profile'::TEXT, p.full_name, '@' || COALESCE(p.username, 'user'), p.metadata->>'avatar_url', 
           jsonb_build_object('bio', p.bio)
    FROM profiles p WHERE p.full_name ILIKE '%' || search_query || '%' OR p.username ILIKE '%' || search_query || '%'
    LIMIT 20;
END;
$$;

-- Analytics Stats
CREATE OR REPLACE FUNCTION public.get_host_daily_stats(host_uuid UUID)
RETURNS TABLE (day DATE, views BIGINT, likes BIGINT, saves BIGINT, shares BIGINT, bookings BIGINT, revenue NUMERIC, followers BIGINT, profile_views BIGINT) 
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day')::DATE AS d)
    SELECT ds.d, COUNT(DISTINCT v.id), COUNT(DISTINCT l.id), COUNT(DISTINCT s.id), COUNT(DISTINCT sh.id), 
           COUNT(DISTINCT b.id), COALESCE(SUM(b.amount), 0), COUNT(DISTINCT f.id), COUNT(DISTINCT pv.id)
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
    GROUP BY ds.d ORDER BY ds.d ASC;
END;
$$;

-- 10. CLOUDINARY TRANSCODING TRIGGER
-- This ensures that when a video is uploaded, we immediately trigger the Edge Function
-- to request an eager transformation from Cloudinary (q_auto,f_auto).
CREATE OR REPLACE FUNCTION public.handle_video_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url TEXT := 'https://rjzgzxxdrltlteeshtuw.supabase.co';
  service_key TEXT;
BEGIN
  -- Get service role key from Vault or fallback to empty
  BEGIN
    service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    service_key := '';
  END;

  -- Only fire if we have a cloudinary video
  IF NEW.video_url ILIKE '%cloudinary.com%' THEN
    PERFORM
      net.http_post(
        url := project_url || '/functions/v1/transcode-video',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_video_upload ON public.reels;
CREATE TRIGGER on_video_upload
  AFTER INSERT ON public.reels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_video_upload();
