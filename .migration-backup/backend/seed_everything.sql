-- Master Seed Script for Zuru Reels
-- This script handles Profiles, Experiences, and Reels
-- It ensures a rich dataset for testing Zuru Pulse, Discover, and Bookings.

DO $$ 
DECLARE 
    v_user_id uuid;
    v_host_id uuid;
    v_exp_id uuid;
BEGIN
    -- 1. Get/Verify User IDs
    -- We assume at least one user exists. If not, we use a fallback or skip.
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    SELECT id INTO v_host_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'No users found in auth.users. Please sign up first.';
        RETURN;
    END IF;

    -- Ensure v_host_id is different if possible
    IF v_host_id = v_user_id THEN
        RAISE NOTICE 'Only one user found. Using person for both roles.';
    END IF;

    -- 2. Clean existing data (ORDER MATTERS)
    DELETE FROM public.reels;
    DELETE FROM public.bookings;
    DELETE FROM public.experiences;
    -- Note: Profiles are references to auth.users, usually handled by triggers, but let's ensure metadata exists
    
    -- 3. Update Profile Metadata for "Zuru Pass" testing
    UPDATE public.profiles SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{has_pass}', 'true') WHERE id = v_user_id;
    UPDATE public.profiles SET role = 'host', metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{entity_name}', '"Coastal Paradise Ventures"') WHERE id = v_host_id;

    -- 4. Insert Experiences
    -- VILLA in Diani
    INSERT INTO public.experiences (user_id, category, entity_name, title, description, location, image_url, current_price, price_unit, metadata)
    VALUES (v_host_id, 'villa', 'Palm Heights Villa', 'Beachfront Luxury Villa', '4-bedroom villa with private pool.', 'Diani Beach', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', 45000, 'night', '{"rating": 4.9, "amenities": ["Pool", "WiFi", "Chef"]}')
    RETURNING id INTO v_exp_id;

    INSERT INTO public.reels (user_id, experience_id, category, video_url, thumbnail_url, duration, is_live, status)
    VALUES (v_host_id, v_exp_id, 'villa', 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400', 15, false, 'active');

    -- BOAT in Mombasa
    INSERT INTO public.experiences (user_id, category, entity_name, title, description, location, image_url, current_price, price_unit, metadata)
    VALUES (v_host_id, 'boats', 'Mombasa Marine', 'Luxury Sunset Yacht', 'Sailing the old port at sunset.', 'Mombasa', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800', 12000, 'hour', '{"rating": 5.0, "capacity": 10}')
    RETURNING id INTO v_exp_id;

    INSERT INTO public.reels (user_id, experience_id, category, video_url, thumbnail_url, duration, is_live, status)
    VALUES (v_host_id, v_exp_id, 'boats', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=400', 12, true, 'active');

    -- EVENT / NIGHTLIFE in Watamu
    INSERT INTO public.experiences (user_id, category, entity_name, title, description, location, image_url, current_price, price_unit, metadata)
    VALUES (v_host_id, 'nightlife', 'Papa Remo', 'Full Moon Party', 'Dance under the stars.', 'Watamu', 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800', 1000, 'entry', '{"dj": "DJ Slick", "time": "9 PM", "date": "2026-03-20"}')
    RETURNING id INTO v_exp_id;

    INSERT INTO public.reels (user_id, experience_id, category, video_url, thumbnail_url, duration, is_live, status)
    VALUES (v_host_id, v_exp_id, 'nightlife', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400', 10, true, 'active');

    -- FOOD in Lamu
    INSERT INTO public.experiences (user_id, category, entity_name, title, description, location, image_url, current_price, price_unit, metadata)
    VALUES (v_host_id, 'food', 'Peponi Hotel', 'Coastal Curry Lunch', 'Authentic Lamu flavors.', 'Lamu', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800', 2500, 'person', '{"valid_until": "Today 4PM"}')
    RETURNING id INTO v_exp_id;

    INSERT INTO public.reels (user_id, experience_id, category, video_url, thumbnail_url, duration, is_live, status)
    VALUES (v_host_id, v_exp_id, 'food', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400', 8, false, 'active');

    -- DRINKS in Diani
    INSERT INTO public.experiences (user_id, category, entity_name, title, description, location, image_url, current_price, price_unit, metadata)
    VALUES (v_host_id, 'drinks', 'Nomads', 'Happy Hour Dawa', 'Best Dawa on the coast.', 'Diani Beach', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800', 500, 'drink', '{"happy_hour": "4 PM - 7 PM"}')
    RETURNING id INTO v_exp_id;

    INSERT INTO public.reels (user_id, experience_id, category, video_url, thumbnail_url, duration, is_live, status)
    VALUES (v_host_id, v_exp_id, 'drinks', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400', 5, true, 'active');

    RAISE NOTICE 'Master seeding complete!';
END $$;
