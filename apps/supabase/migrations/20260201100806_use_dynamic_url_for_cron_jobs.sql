-- Store the project's own Supabase URL in app_config so cron jobs can
-- target the correct environment. This prevents non-prod cron jobs from
-- accidentally hitting production edge functions.
ALTER TABLE app_config
ADD COLUMN IF NOT EXISTS supabase_url TEXT;

-- Helper function for building edge function URLs from app_config
CREATE OR REPLACE FUNCTION get_supabase_edge_function_url(function_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT (SELECT supabase_url FROM app_config LIMIT 1)
           || '/functions/v1/'
           || function_name;
$$;

-- Resolve the URL when each job runs, rather than while migrations are applied.
-- A fresh local database therefore remains reproducible and fails closed until
-- its environment-specific URL is configured.

-- Safely unschedule all existing cron jobs (ignore if they don't exist)
DO $$
DECLARE
    job_names TEXT[] := ARRAY[
        'send-pack-change-notifications',
        'send-partner-activity-notifications',
        'process-scheduled-releases',
        'check-streak-milestones',
        'send-match-notification-digests',
        'send-weekly-summary',
        'send-unpaired-reminders',
        'send-catchup-reminders'
    ];
    j TEXT;
BEGIN
    FOREACH j IN ARRAY job_names LOOP
        BEGIN
            PERFORM cron.unschedule(j);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Job % not found, skipping unschedule', j;
        END;
    END LOOP;
END;
$$;

-- Re-register all cron jobs using dynamic URLs.
-- format() resolves at migration-time, baking the correct URL into the cron command.

SELECT cron.schedule(
    'send-pack-change-notifications',
    '*/5 * * * *',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('send-pack-change-notification'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);

SELECT cron.schedule(
    'send-partner-activity-notifications',
    '*/5 * * * *',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('send-partner-activity-notification'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);

SELECT cron.schedule(
    'process-scheduled-releases',
    '*/5 * * * *',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('process-scheduled-releases'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);

SELECT cron.schedule(
    'check-streak-milestones',
    '5 0 * * *',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('check-streak-milestones'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);

SELECT cron.schedule(
    'send-match-notification-digests',
    '* * * * *',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('send-match-notification-digest'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);

SELECT cron.schedule(
    'send-weekly-summary',
    '0 10 * * 0',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('send-weekly-summary'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);

SELECT cron.schedule(
    'send-unpaired-reminders',
    '0 18 * * *',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('send-unpaired-reminder'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);

SELECT cron.schedule(
    'send-catchup-reminders',
    '0 17 * * *',
    $cmd$
        SELECT net.http_post(
            url := get_supabase_edge_function_url('send-catchup-reminder'),
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
    $cmd$
);
