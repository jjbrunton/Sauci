-- Add tracking column for unpaired reminder rate limiting
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_unpaired_reminder_at TIMESTAMPTZ;

-- Add preference toggle for unpaired reminders
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS unpaired_reminders_enabled BOOLEAN DEFAULT true;

-- Schedule daily cron job at 18:00 UTC to send unpaired reminders
SELECT cron.schedule(
    'send-unpaired-reminders',
    '0 18 * * *',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-unpaired-reminder',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
