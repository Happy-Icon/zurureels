-- Seed Data for Experiences Table
-- Replace 'YOUR_USER_ID' with a valid user UUID from your auth.users table

-- Clear existing data (optional)
-- DELETE FROM public.experiences;

INSERT INTO public.experiences (user_id, category, entity_name, title, description, location, image_url, base_price, current_price, price_unit, metadata)
VALUES
-- Boats
('YOUR_USER_ID', 'boats', 'Glass Bottom Boat Tour', 'Glass Bottom Boat Tour', 'Explore the underwater world without getting wet.', 'Diani Beach', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop', 3500, 3500, 'person', '{"type": "Glass Bottom", "rating": 4.8}'),
('YOUR_USER_ID', 'boats', 'Traditional Dhow Sunset Cruise', 'Traditional Dhow Sunset Cruise', 'Sail into the sunset on a traditional Swahili dhow.', 'Lamu Island', 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=400&h=300&fit=crop', 8000, 8000, 'person', '{"type": "Dhow", "rating": 4.9}'),

-- Food (Restaurant Specials)
('YOUR_USER_ID', 'food', 'Sails Beach Bar', 'Seafood Platter for 2', 'A feast of fresh local seafood.', 'Diani Beach', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop', 4500, 3200, 'person', '{"valid_until": "Tonight only"}'),
('YOUR_USER_ID', 'food', 'Tamarind Mombasa', 'Swahili Curry Feast', 'Rich and aromatic Swahili flavors.', 'Mombasa', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop', 2800, 1900, 'person', '{"valid_until": "Lunch special"}'),

-- Food (Chef Specials)
('YOUR_USER_ID', 'food', 'Ali Barbour''s Cave', 'Coconut Crab Linguine', 'Fresh crab in a creamy coconut sauce.', 'Diani Beach', 'https://images.unsplash.com/photo-1579631542720-3a87824fff86?w=400&h=300&fit=crop', null, 2800, 'person', '{"chef": "Chef Mwangi"}'),

-- Nightlife
('YOUR_USER_ID', 'nightlife', 'Forty Thieves Beach Bar', 'Reggae Night', 'The ultimate beach party vibes.', 'Diani Beach', 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=300&fit=crop', null, 500, 'entry', '{"dj": "DJ Mzungu", "time": "9 PM - Late"}'),

-- Bikes
('YOUR_USER_ID', 'bikes', 'Diani Bikes', 'Beach Cruiser', 'Perfect for riding along the shoreline.', 'Diani Beach', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop', null, 1500, 'day', '{"type": "Beach Cruiser", "available_count": 8}'),

-- Activities
('YOUR_USER_ID', 'activities', 'Dolphin Watching Tour', 'Dolphin Watching Tour', 'Meet the dolphins in their natural habitat.', 'Watamu', 'https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=400&h=300&fit=crop', null, 4500, 'person', '{"type": "Nature", "time": "7:00 AM", "duration": "3 hours", "spots_left": 4}'),

-- Drinks
('YOUR_USER_ID', 'drinks', 'Sails Beach Bar', 'Dawa Cocktail', 'The iconic Kenyan restorative drink.', 'Diani Beach', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop', 800, 500, 'drink', '{}');
