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

-- Re-register all cron jobs using the helper function.
-- format() resolves at migration-time, baking the URL into the cron command.
-- IMPORTANT: app_config.supabase_url MUST be set before this migration runs.
-- CI should run: UPDATE app_config SET supabase_url = '...' before db push,
-- or it can be seeded manually per environment.

-- For safety, abort if supabase_url is not set
DO $$
BEGIN
    IF (SELECT supabase_url FROM app_config LIMIT 1) IS NULL THEN
        RAISE EXCEPTION 'app_config.supabase_url must be set before running this migration. '
            'Run: UPDATE app_config SET supabase_url = ''https://<project-ref>.supabase.co'';';
    END IF;
END;
$$;

SELECT cron.unschedule('send-pack-change-notifications');
SELECT cron.schedule(
    'send-pack-change-notifications',
    '*/5 * * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('send-pack-change-notification')
    )
);

SELECT cron.unschedule('send-partner-activity-notifications');
SELECT cron.schedule(
    'send-partner-activity-notifications',
    '*/5 * * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('send-partner-activity-notification')
    )
);

SELECT cron.unschedule('process-scheduled-releases');
SELECT cron.schedule(
    'process-scheduled-releases',
    '*/5 * * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('process-scheduled-releases')
    )
);

SELECT cron.unschedule('check-streak-milestones');
SELECT cron.schedule(
    'check-streak-milestones',
    '5 0 * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('check-streak-milestones')
    )
);

SELECT cron.unschedule('send-match-notification-digests');
SELECT cron.schedule(
    'send-match-notification-digests',
    '* * * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('send-match-notification-digest')
    )
);

SELECT cron.unschedule('send-weekly-summary');
SELECT cron.schedule(
    'send-weekly-summary',
    '0 10 * * 0',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('send-weekly-summary')
    )
);

SELECT cron.unschedule('send-unpaired-reminders');
SELECT cron.schedule(
    'send-unpaired-reminders',
    '0 18 * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('send-unpaired-reminder')
    )
);

SELECT cron.unschedule('send-catchup-reminders');
SELECT cron.schedule(
    'send-catchup-reminders',
    '0 17 * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('send-catchup-reminder')
    )
);
