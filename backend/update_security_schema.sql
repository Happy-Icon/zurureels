-- Migration: Add Security Settings to profiles table

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS security_settings jsonb DEFAULT '{"two_factor": false, "login_alerts": true, "sms_notifications": false}'::jsonb;

COMMENT ON COLUMN profiles.security_settings IS 'User security preferences like 2FA and login alerts';
