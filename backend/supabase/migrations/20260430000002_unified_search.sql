-- Unified Search RPC
-- Enables searching across experiences, profiles, and events in a single call

CREATE OR REPLACE FUNCTION public.unified_search(search_query TEXT)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    subtitle TEXT,
    image_url TEXT,
    metadata JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- 1. Experiences & Reels
    SELECT 
        e.id,
        'experience'::TEXT as type,
        e.title,
        e.location as subtitle,
        e.image_url,
        jsonb_build_object('category', e.category, 'price', e.current_price) as metadata
    FROM public.experiences e
    WHERE 
        e.title ILIKE '%' || search_query || '%' OR 
        e.location ILIKE '%' || search_query || '%' OR
        e.entity_name ILIKE '%' || search_query || '%'
    
    UNION ALL

    -- 2. Profiles (Hosts)
    SELECT 
        p.id,
        'profile'::TEXT as type,
        p.full_name as title,
        COALESCE(p.username, 'Host') as subtitle,
        p.metadata->>'avatar_url' as image_url,
        jsonb_build_object('bio', p.bio, 'verification', p.verification_status) as metadata
    FROM public.profiles p
    WHERE 
        p.full_name ILIKE '%' || search_query || '%' OR 
        p.username ILIKE '%' || search_query || '%' OR
        p.bio ILIKE '%' || search_query || '%'
    
    UNION ALL

    -- 3. Events
    SELECT 
        ev.id,
        'event'::TEXT as type,
        ev.title,
        ev.location as subtitle,
        ev.image_url,
        jsonb_build_object('date', ev.event_date, 'category', ev.category) as metadata
    FROM public.events ev
    WHERE 
        ev.title ILIKE '%' || search_query || '%' OR 
        ev.location ILIKE '%' || search_query || '%' OR
        ev.description ILIKE '%' || search_query || '%'
    
    ORDER BY title ASC
    LIMIT 20;
END;
$$;
