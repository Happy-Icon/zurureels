ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{"channels": {"email": true, "sms": true, "push": true, "whatsapp": false}, "trips": {"bookings": true, "checkin": true, "messages": true}, "security": {"login": true, "password": true}, "marketing": {"price_drops": false, "recommendations": true, "newsletter": true, "frequency": "weekly"}}'::jsonb;
