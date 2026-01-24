-- Add partner activity notification system
-- Notifies partner when a user answers questions (batched with 1-hour debounce)

-- Add last_active_at to profiles for "is user in app" check
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
-- Create pending activity notifications table
CREATE TABLE pending_activity_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    active_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    response_count INTEGER DEFAULT 1,
    notify_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(couple_id)  -- Only one pending notification per couple (enables UPSERT for timer reset)
);
-- Index for efficient cron queries
CREATE INDEX idx_pending_activity_notifications_notify_at
    ON pending_activity_notifications(notify_at);
-- Enable RLS
ALTER TABLE pending_activity_notifications ENABLE ROW LEVEL SECURITY;
-- RLS policies
CREATE POLICY "Users can view their couple's pending activity notifications"
    ON pending_activity_notifications FOR SELECT
    USING (couple_id = get_auth_user_couple_id());
CREATE POLICY "Super admins can view all pending activity notifications"
    ON pending_activity_notifications FOR SELECT
    USING (is_super_admin());
-- Updated_at trigger
CREATE TRIGGER update_pending_activity_notifications_updated_at
    BEFORE UPDATE ON pending_activity_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Function to queue partner activity notifications
-- Called via trigger when a response is inserted or updated
CREATE OR REPLACE FUNCTION queue_partner_activity_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_couple_id UUID;
BEGIN
    -- Get the user making the response
    v_user_id := auth.uid();

    -- Skip if no auth context (service role operations)
    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get user's couple_id
    SELECT couple_id INTO v_couple_id
    FROM profiles
    WHERE id = v_user_id;

    -- Skip if user is not in a couple
    IF v_couple_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- UPSERT: Insert new notification or reset timer and increment count
    INSERT INTO pending_activity_notifications (
        couple_id,
        active_user_id,
        response_count,
        notify_at
    )
    VALUES (
        v_couple_id,
        v_user_id,
        1,
        now() + interval '1 hour'
    )
    ON CONFLICT (couple_id) DO UPDATE SET
        active_user_id = EXCLUDED.active_user_id,
        response_count = pending_activity_notifications.response_count + 1,
        notify_at = now() + interval '1 hour',
        updated_at = now();

    RETURN NEW;
END;
$$;
-- Create trigger on responses table
CREATE TRIGGER on_response_submitted
    AFTER INSERT OR UPDATE OF answer ON responses
    FOR EACH ROW
    EXECUTE FUNCTION queue_partner_activity_notification();
-- Schedule cron job (runs every 5 minutes)
SELECT cron.schedule(
    'send-partner-activity-notifications',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-partner-activity-notification',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
