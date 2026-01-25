-- Session-based notification system
--
-- Changes from the previous match-based notification system:
-- 1. Notifications are triggered by ANY response, not just matches
-- 2. Tracks which user is actively answering (active_user_id)
-- 3. Only notifies the partner of the active user (not both)
-- 4. Uses rolling 5-minute inactivity window instead of fixed 2-minute delay
-- 5. Notification copy changes to "[Partner] has been answering questions!"

-- Add new columns to pending_match_notifications
ALTER TABLE pending_match_notifications
ADD COLUMN IF NOT EXISTS active_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS response_count INTEGER NOT NULL DEFAULT 0;

-- Drop the old trigger on matches (we'll trigger on responses instead)
DROP TRIGGER IF EXISTS on_match_created ON matches;

-- Create or replace the notification queue function
-- Now triggers on responses instead of matches
CREATE OR REPLACE FUNCTION queue_response_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_couple_id UUID;
BEGIN
    -- Get couple_id from the response
    v_couple_id := NEW.couple_id;

    -- Skip if no couple_id (shouldn't happen, but safety check)
    IF v_couple_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Insert or update pending notification with rolling 5-minute window
    -- The notification is for the PARTNER of the user who is answering
    INSERT INTO pending_match_notifications (
        couple_id,
        active_user_id,
        match_count,
        response_count,
        latest_match_id,
        notify_at
    )
    VALUES (
        v_couple_id,
        NEW.user_id,
        0, -- match_count starts at 0, will be incremented by match trigger if needed
        1,
        NULL, -- No match yet
        now() + interval '5 minutes' -- Rolling 5-minute inactivity window
    )
    ON CONFLICT (couple_id) DO UPDATE SET
        active_user_id = NEW.user_id, -- Update who is active
        response_count = pending_match_notifications.response_count + 1,
        notify_at = now() + interval '5 minutes', -- Reset the 5-minute timer
        updated_at = now();

    RETURN NEW;
END;
$$;

-- Create or replace the match count incrementer
-- This runs when a match is created to track match_count separately
CREATE OR REPLACE FUNCTION increment_pending_match_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Update the pending notification to increment match count and store latest match
    UPDATE pending_match_notifications
    SET
        match_count = match_count + 1,
        latest_match_id = NEW.id,
        updated_at = now()
    WHERE couple_id = NEW.couple_id;

    RETURN NEW;
END;
$$;

-- Trigger on responses table for activity tracking
CREATE TRIGGER on_response_created
    AFTER INSERT ON responses
    FOR EACH ROW
    EXECUTE FUNCTION queue_response_notification();

-- Trigger on matches table just to track match count
CREATE TRIGGER on_match_created_count
    AFTER INSERT ON matches
    FOR EACH ROW
    EXECUTE FUNCTION increment_pending_match_count();

-- Add index on active_user_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_pending_match_notifications_active_user
    ON pending_match_notifications(active_user_id);

-- Comment explaining the new behavior
COMMENT ON TABLE pending_match_notifications IS
'Session-based notification queue. Tracks when a user is actively answering questions
and sends a single digest notification to their partner after 5 minutes of inactivity.
- active_user_id: The user who was answering (their partner receives the notification)
- response_count: Total responses during this session
- match_count: Number of matches created during this session
- notify_at: When to send the notification (rolling 5-min from last activity)';
