-- Seed Data for Experiences Table
-- This script automatically finds the first user in your auth.users table to avoid foreign key errors.

DO $$ 
DECLARE 
    v_user_id uuid;
BEGIN
    -- Get the first available user ID from auth.users
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;

    -- If no user exists, this script will stop here to avoid errors
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'No user found in auth.users. Please sign up in the app first.';
    ELSE
        -- Clear existing data to avoid duplicates
        DELETE FROM public.experiences;

        INSERT INTO public.experiences (user_id, category, entity_name, title, description, location, image_url, base_price, current_price, price_unit, metadata)
        VALUES
        -- Boats
        (v_user_id, 'boats', 'Glass Bottom Boat Tour', 'Glass Bottom Boat Tour', 'Explore the underwater world.', 'Diani Beach', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop', 3500, 3500, 'person', '{"type": "Glass Bottom", "rating": 4.8}'),
        (v_user_id, 'boats', 'Mombasa Harbor Cruise', 'Luxury Yacht Sunset', 'A premium sunset experience.', 'Mombasa', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=400&h=300&fit=crop', 15000, 12000, 'hour', '{"type": "Yacht", "rating": 5.0}'),
        
        -- Food
        (v_user_id, 'food', 'Sails Beach Bar', 'Seafood Platter for 2', 'Fresh local seafood.', 'Diani Beach', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop', 4500, 3200, 'person', '{"valid_until": "Tonight only"}'),
        (v_user_id, 'food', 'Tamarind Mombasa', 'Swahili Curry Feast', 'Rich aromatic flavors.', 'Mombasa', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop', 2800, 1900, 'person', '{"valid_until": "Lunch special"}'),
        (v_user_id, 'food', 'Ali Barbour''s Cave', 'Coconut Crab Linguine', 'Fresh crab in a cave.', 'Diani Beach', 'https://images.unsplash.com/photo-1579631542720-3a87824fff86?w=400&h=300&fit=crop', null, 2800, 'person', '{"chef": "Chef Mwangi"}'),
        
        -- Nightlife
        (v_user_id, 'nightlife', 'Forty Thieves', 'Reggae Night', 'Beach party vibes.', 'Diani Beach', 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=300&fit=crop', null, 500, 'entry', '{"dj": "DJ Mzungu", "time": "9 PM"}'),
        (v_user_id, 'nightlife', 'Taproom Mombasa', 'Jazz & Gin', 'Classy evening vibes.', 'Mombasa', 'https://images.unsplash.com/photo-1514525253361-bee23e970a01?w=400&h=300&fit=crop', null, 1000, 'entry', '{"dj": "Jazz Band", "time": "8 PM"}'),
        
        -- Bikes
        (v_user_id, 'bikes', 'Diani Bikes', 'Beach Cruiser', 'Ride the shoreline.', 'Diani Beach', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop', null, 1500, 'day', '{"type": "Cruiser", "available_count": 8}'),
        (v_user_id, 'bikes', 'Mombasa Cyclists', 'Mountain Bike', 'Old Town tour.', 'Mombasa', 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=400&h=300&fit=crop', null, 2000, 'day', '{"type": "Mountain", "available_count": 5}'),

        -- Drinks
        (v_user_id, 'drinks', 'Sails Beach Bar', 'Dawa Cocktail', 'Iconic Kenyan drink.', 'Diani Beach', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop', 800, 500, 'drink', '{}'),
        (v_user_id, 'drinks', 'Moonshine Mombasa', 'Passion Mojito', 'Fresh and fruity.', 'Mombasa', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop', 1200, 900, 'drink', '{}'),

        -- Activities
        (v_user_id, 'activities', 'Dolphin Watch', 'Dolphin Tour', 'See them in the wild.', 'Watamu', 'https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=400&h=300&fit=crop', null, 4500, 'person', '{"type": "Nature", "time": "7 AM", "duration": "3h", "spots_left": 4}');
    END IF;
END $$;

