-- Add weekly_summary_enabled to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS weekly_summary_enabled BOOLEAN DEFAULT true;

-- Schedule weekly summary notification: Sunday 10:00 UTC
SELECT cron.schedule(
    'send-weekly-summary',
    '0 10 * * 0',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-weekly-summary',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
