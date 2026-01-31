-- Catchup reminder tracking table
CREATE TABLE IF NOT EXISTS catchup_reminder_tracking (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    pending_since TIMESTAMPTZ,
    last_reminder_sent_at TIMESTAMPTZ,
    reminder_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS (service role only)
ALTER TABLE catchup_reminder_tracking ENABLE ROW LEVEL SECURITY;

-- Add preference toggle for catchup reminders
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS catchup_reminders_enabled BOOLEAN DEFAULT true;

-- Schedule daily cron job at 17:00 UTC to send catchup reminders
SELECT cron.schedule(
    'send-catchup-reminders',
    '0 17 * * *',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-catchup-reminder',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
