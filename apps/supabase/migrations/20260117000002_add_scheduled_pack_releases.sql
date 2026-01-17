-- Add scheduled pack release system
-- Allows admins to schedule pack releases and automatically notifies users

-- Add scheduling columns to question_packs
ALTER TABLE question_packs
    ADD COLUMN IF NOT EXISTS scheduled_release_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS release_notified BOOLEAN DEFAULT false;

-- Index for efficient cron queries
CREATE INDEX idx_question_packs_scheduled_release
    ON question_packs(scheduled_release_at)
    WHERE scheduled_release_at IS NOT NULL AND is_public = false;

-- Schedule cron job for processing scheduled releases (runs every 5 minutes)
SELECT cron.schedule(
    'process-scheduled-releases',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/process-scheduled-releases',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
