-- ============================================================
-- UPCOMING EVENTS FEATURE — DATABASE MIGRATION
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- 1. Add notification_intervals column to events table
-- Hosts use this to control when subscribers get reminded
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS notification_intervals JSONB DEFAULT '["24h", "1h"]';

COMMENT ON COLUMN public.events.notification_intervals IS 
  'Host-configured reminder intervals before event. Values: ["48h","24h","1h","15min"]';

-- 2. Create event_subscribers table
-- Tracks which users opted in to receive reminders for which events
CREATE TABLE IF NOT EXISTS public.event_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channels TEXT[] DEFAULT ARRAY['in_app'],  -- ['in_app', 'push', 'email']
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- One subscription per user per event
    UNIQUE(event_id, user_id)
);

-- Fast lookups
CREATE INDEX IF NOT EXISTS idx_event_subs_event ON public.event_subscribers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_subs_user ON public.event_subscribers(user_id);

-- RLS
ALTER TABLE public.event_subscribers ENABLE ROW LEVEL SECURITY;

-- Users can insert/delete/read their own subscriptions
CREATE POLICY "Users can subscribe to events" 
    ON public.event_subscribers FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsubscribe from events" 
    ON public.event_subscribers FOR DELETE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" 
    ON public.event_subscribers FOR SELECT 
    USING (auth.uid() = user_id);

-- Hosts can see who subscribed to their events
CREATE POLICY "Hosts view their event subscribers" 
    ON public.event_subscribers FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE events.id = event_subscribers.event_id 
            AND events.user_id = auth.uid()
        )
    );

-- 3. Create event_notification_log table
-- Prevents sending the same reminder twice (deduplication)
CREATE TABLE IF NOT EXISTS public.event_notification_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interval_label TEXT NOT NULL,        -- '48h', '24h', '1h', '15min'
    channel TEXT NOT NULL,               -- 'in_app', 'push', 'email'
    sent_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'sent',          -- 'sent', 'delivered', 'failed'
    
    -- Deduplication: one notification per user/event/interval/channel combo
    UNIQUE(event_id, user_id, interval_label, channel)
);

CREATE INDEX IF NOT EXISTS idx_notif_log_event ON public.event_notification_log(event_id);

-- RLS
ALTER TABLE public.event_notification_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification history
CREATE POLICY "Users view own notification log" 
    ON public.event_notification_log FOR SELECT 
    USING (auth.uid() = user_id);

-- Service role (Edge Functions) can insert — handled by default service_role bypass


-- 4. Helper function: Get subscriber count for an event
CREATE OR REPLACE FUNCTION public.get_event_subscriber_count(p_event_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER 
    FROM public.event_subscribers 
    WHERE event_id = p_event_id;
$$;


-- 5. Helper function: Check if current user is subscribed to an event
CREATE OR REPLACE FUNCTION public.is_subscribed_to_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.event_subscribers 
        WHERE event_id = p_event_id 
        AND user_id = auth.uid()
    );
$$;

-- ============================================================
-- DONE! All tables created, RLS enabled, helper functions ready.
-- ============================================================
