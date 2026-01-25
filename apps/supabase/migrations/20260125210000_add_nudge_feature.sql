-- Add nudge feature support
-- Allows partners to send reminder notifications with rate limiting

-- Add nudge tracking to profiles (for rate limiting)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_nudge_sent_at TIMESTAMPTZ;

-- Add nudge preference to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS nudges_enabled BOOLEAN DEFAULT true;

-- Comment for documentation
COMMENT ON COLUMN profiles.last_nudge_sent_at IS 'Timestamp of last nudge sent to partner (rate limited to once per 12 hours)';
COMMENT ON COLUMN notification_preferences.nudges_enabled IS 'Whether to receive nudge notifications from partner';
