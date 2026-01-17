-- Add match notification digest system
-- Coalesces multiple match events into a single push notification.
--
-- Design goals:
-- - Reduce push spam when many matches occur quickly
-- - Keep delivery latency bounded (<= ~2 minutes)
-- - Keep match creation real-time; only push notifications are delayed

-- Create pending match notifications table
CREATE TABLE pending_match_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    match_count INTEGER NOT NULL DEFAULT 1,
    latest_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    notify_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(couple_id) -- One pending notification per couple (UPSERT timer reset)
);

-- Index for efficient cron queries
CREATE INDEX idx_pending_match_notifications_notify_at
    ON pending_match_notifications(notify_at);

-- Enable RLS
ALTER TABLE pending_match_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their couple's pending match notifications"
    ON pending_match_notifications FOR SELECT
    USING (couple_id = get_auth_user_couple_id());

CREATE POLICY "Super admins can view all pending match notifications"
    ON pending_match_notifications FOR SELECT
    USING (is_super_admin());

-- Updated_at trigger
CREATE TRIGGER update_pending_match_notifications_updated_at
    BEFORE UPDATE ON pending_match_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to queue match notifications
-- Runs whenever a new match row is inserted.
-- The notify_at value is aligned to minute boundaries so that a once-per-minute cron
-- can deliver notifications within ~1-2 minutes.
CREATE OR REPLACE FUNCTION queue_match_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO pending_match_notifications (
        couple_id,
        match_count,
        latest_match_id,
        notify_at
    )
    VALUES (
        NEW.couple_id,
        1,
        NEW.id,
        date_trunc('minute', now()) + interval '2 minutes'
    )
    ON CONFLICT (couple_id) DO UPDATE SET
        match_count = pending_match_notifications.match_count + 1,
        latest_match_id = NEW.id,
        notify_at = date_trunc('minute', now()) + interval '2 minutes',
        updated_at = now();

    RETURN NEW;
END;
$$;

-- Trigger on matches table
CREATE TRIGGER on_match_created
    AFTER INSERT ON matches
    FOR EACH ROW
    EXECUTE FUNCTION queue_match_notification();

-- Schedule cron job (runs every minute)
SELECT cron.schedule(
    'send-match-notification-digests',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-match-notification-digest',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
