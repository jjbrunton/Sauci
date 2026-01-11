-- Add delayed pack change notification system
-- Notifies partner when a user enables new question packs (with 30-min debounce)

-- Create pending notifications table
CREATE TABLE pending_pack_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    changed_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notify_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(couple_id)  -- Only one pending notification per couple (enables UPSERT for timer reset)
);

-- Index for efficient cron queries
CREATE INDEX idx_pending_pack_notifications_notify_at
    ON pending_pack_notifications(notify_at);

-- Enable RLS
ALTER TABLE pending_pack_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their couple's pending notifications"
    ON pending_pack_notifications FOR SELECT
    USING (couple_id = get_auth_user_couple_id());

CREATE POLICY "Super admins can view all pending notifications"
    ON pending_pack_notifications FOR SELECT
    USING (is_super_admin());

-- Updated_at trigger
CREATE TRIGGER update_pending_pack_notifications_updated_at
    BEFORE UPDATE ON pending_pack_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to queue pack change notifications
CREATE OR REPLACE FUNCTION queue_pack_change_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Only trigger when enabling a pack (not disabling)
    IF NEW.enabled = false THEN
        RETURN NEW;
    END IF;

    -- For UPDATE, only proceed if changing from disabled to enabled
    IF TG_OP = 'UPDATE' AND OLD.enabled = true THEN
        RETURN NEW;
    END IF;

    -- Get the user making the change
    v_user_id := auth.uid();

    -- Skip if no auth context (service role operations)
    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- UPSERT: Insert new notification or reset timer on existing one
    INSERT INTO pending_pack_notifications (
        couple_id,
        changed_by_user_id,
        notify_at
    )
    VALUES (
        NEW.couple_id,
        v_user_id,
        now() + interval '30 minutes'
    )
    ON CONFLICT (couple_id) DO UPDATE SET
        changed_by_user_id = EXCLUDED.changed_by_user_id,
        notify_at = now() + interval '30 minutes',
        updated_at = now();

    RETURN NEW;
END;
$$;

-- Create trigger on couple_packs
CREATE TRIGGER on_couple_pack_enabled
    AFTER INSERT OR UPDATE OF enabled ON couple_packs
    FOR EACH ROW
    EXECUTE FUNCTION queue_pack_change_notification();

-- Schedule cron job (runs every 5 minutes)
SELECT cron.schedule(
    'send-pack-change-notifications',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-pack-change-notification',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
