-- ==========================================
-- ZURUSASA FINAL PRODUCTION MASTER MIGRATION
-- Consolidated Platform Schema (April 30, 2026)
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  full_name TEXT,
  username TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  business_name TEXT,
  id_number TEXT,
  verification_status TEXT DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected')),
  role TEXT DEFAULT 'guest',
  host_role TEXT DEFAULT 'guest',
  profile_completeness INTEGER DEFAULT 20,
  stripe_account_id TEXT,
  stripe_onboarded BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- 5. EVENTS
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    price NUMERIC,
    image_url TEXT,
    attendees INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    notification_intervals JSONB DEFAULT '["24h", "1h"]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active events" ON public.events;
CREATE POLICY "Anyone can view active events" ON public.events FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS "Hosts can manage own events" ON public.events;
CREATE POLICY "Hosts can manage own events" ON public.events FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 6. MESSAGING SYSTEM
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_one UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    participant_two UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant_one, participant_two)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = participant_one OR auth.uid() = participant_two);
DROP POLICY IF EXISTS "Users can insert conversations they participate in" ON public.conversations;
CREATE POLICY "Users can insert conversations they participate in" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND (participant_one = auth.uid() OR participant_two = auth.uid())));
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
CREATE POLICY "Users can insert messages in their conversations" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND (participant_one = auth.uid() OR participant_two = auth.uid())));

-- 7. INTERACTIONS & SUBSCRIPTIONS
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

CREATE TABLE IF NOT EXISTS public.event_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channels TEXT[] DEFAULT ARRAY['in_app'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes visible to all" ON public.reel_likes;
CREATE POLICY "Likes visible to all" ON public.reel_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage likes" ON public.reel_likes;
CREATE POLICY "Users can manage likes" ON public.reel_likes FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage saves" ON public.reel_saves;
CREATE POLICY "Users can manage saves" ON public.reel_saves FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Follows visible to all" ON public.user_follows;
CREATE POLICY "Follows visible to all" ON public.user_follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage follows" ON public.user_follows;
CREATE POLICY "Users can manage follows" ON public.user_follows FOR ALL TO authenticated USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can manage event subs" ON public.event_subscribers;
CREATE POLICY "Users can manage event subs" ON public.event_subscribers FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 8. ANALYTICS & LOGS
CREATE TABLE IF NOT EXISTS public.reel_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.host_profile_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. FUNCTIONS & TRIGGERS
-- Handle New User
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
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Anti-Disintermediation Filter
CREATE OR REPLACE FUNCTION public.filter_contact_info()
RETURNS TRIGGER AS $$
DECLARE
    contact_pattern TEXT := '(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}';
BEGIN
    IF NEW.content ~ contact_pattern THEN
        NEW.is_flagged := TRUE;
    END IF;
    UPDATE public.conversations SET last_message_at = NOW() WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.filter_contact_info();

-- Video Upload / Transcode
CREATE OR REPLACE FUNCTION public.handle_video_upload()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT := 'https://rjzgzxxdrltlteeshtuw.supabase.co';
  service_key TEXT;
BEGIN
  BEGIN service_key := current_setting('app.settings.service_role_key', true); EXCEPTION WHEN OTHERS THEN service_key := ''; END;
  IF NEW.video_url ILIKE '%cloudinary.com%' THEN
    PERFORM net.http_post(url := project_url || '/functions/v1/transcode-video', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key), body := jsonb_build_object('record', row_to_json(NEW)));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_video_upload ON public.reels;
CREATE TRIGGER on_video_upload AFTER INSERT ON public.reels FOR EACH ROW EXECUTE FUNCTION public.handle_video_upload();
