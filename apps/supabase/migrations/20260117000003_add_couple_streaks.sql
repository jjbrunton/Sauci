-- Add gentle streaks system
-- Tracks consecutive days both partners answered questions
-- Celebrates milestones without guilt-tripping on breaks

-- Create couple_streaks table
CREATE TABLE couple_streaks (
    couple_id UUID PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_active_date DATE,
    user1_answered_today BOOLEAN DEFAULT false,
    user2_answered_today BOOLEAN DEFAULT false,
    streak_celebrated_at INTEGER DEFAULT 0, -- Last milestone that was celebrated
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
-- Enable RLS
ALTER TABLE couple_streaks ENABLE ROW LEVEL SECURITY;
-- RLS policies
CREATE POLICY "Users can view their couple's streaks"
    ON couple_streaks FOR SELECT
    USING (couple_id = get_auth_user_couple_id());
CREATE POLICY "Super admins can view all streaks"
    ON couple_streaks FOR SELECT
    USING (is_super_admin());
-- Updated_at trigger
CREATE TRIGGER update_couple_streaks_updated_at
    BEFORE UPDATE ON couple_streaks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Function to update streak when a response is submitted
CREATE OR REPLACE FUNCTION update_couple_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_couple_id UUID;
    v_partner_id UUID;
    v_today DATE;
    v_streak RECORD;
    v_user_is_user1 BOOLEAN;
BEGIN
    -- Get the user making the response
    v_user_id := auth.uid();

    -- Skip if no auth context
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

    v_today := CURRENT_DATE;

    -- Get or create streak record
    INSERT INTO couple_streaks (couple_id, last_active_date)
    VALUES (v_couple_id, v_today)
    ON CONFLICT (couple_id) DO NOTHING;

    SELECT * INTO v_streak
    FROM couple_streaks
    WHERE couple_id = v_couple_id
    FOR UPDATE;

    -- Determine if this user is "user1" or "user2"
    -- We use a deterministic method: compare UUIDs
    SELECT id INTO v_partner_id
    FROM profiles
    WHERE couple_id = v_couple_id AND id != v_user_id;

    -- User with smaller UUID is user1
    v_user_is_user1 := v_user_id < COALESCE(v_partner_id, v_user_id);

    -- Check if streak needs to be reset (missed a day)
    IF v_streak.last_active_date IS NOT NULL AND v_streak.last_active_date < v_today - 1 THEN
        -- Streak is broken - silently reset (no guilt-tripping!)
        UPDATE couple_streaks
        SET
            current_streak = 0,
            user1_answered_today = CASE WHEN v_user_is_user1 THEN true ELSE false END,
            user2_answered_today = CASE WHEN v_user_is_user1 THEN false ELSE true END,
            last_active_date = v_today
        WHERE couple_id = v_couple_id;
        RETURN NEW;
    END IF;

    -- Check if this is a new day
    IF v_streak.last_active_date IS NULL OR v_streak.last_active_date < v_today THEN
        -- New day: reset daily flags, keep streak
        UPDATE couple_streaks
        SET
            user1_answered_today = CASE WHEN v_user_is_user1 THEN true ELSE false END,
            user2_answered_today = CASE WHEN v_user_is_user1 THEN false ELSE true END,
            last_active_date = v_today
        WHERE couple_id = v_couple_id;
    ELSE
        -- Same day: mark this user as having answered
        IF v_user_is_user1 THEN
            UPDATE couple_streaks
            SET user1_answered_today = true
            WHERE couple_id = v_couple_id;
        ELSE
            UPDATE couple_streaks
            SET user2_answered_today = true
            WHERE couple_id = v_couple_id;
        END IF;
    END IF;

    -- Check if BOTH partners have now answered today
    SELECT * INTO v_streak
    FROM couple_streaks
    WHERE couple_id = v_couple_id;

    IF v_streak.user1_answered_today AND v_streak.user2_answered_today THEN
        -- Both answered! Increment streak if not already counted for today
        IF v_streak.last_active_date = v_today AND v_streak.current_streak = 0 THEN
            -- First time both answered on a new streak
            UPDATE couple_streaks
            SET
                current_streak = 1,
                longest_streak = GREATEST(longest_streak, 1)
            WHERE couple_id = v_couple_id;
        ELSIF v_streak.last_active_date = v_today THEN
            -- Already counted for today, nothing to do
            NULL;
        ELSE
            -- Continuing streak from previous day
            UPDATE couple_streaks
            SET
                current_streak = current_streak + 1,
                longest_streak = GREATEST(longest_streak, current_streak + 1)
            WHERE couple_id = v_couple_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
-- Create trigger on responses table
CREATE TRIGGER on_response_update_streak
    AFTER INSERT OR UPDATE OF answer ON responses
    FOR EACH ROW
    EXECUTE FUNCTION update_couple_streak();
-- Function to reset daily flags (called by cron at UTC midnight)
CREATE OR REPLACE FUNCTION reset_daily_streak_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    UPDATE couple_streaks
    SET
        user1_answered_today = false,
        user2_answered_today = false
    WHERE last_active_date < CURRENT_DATE;
END;
$$;
-- Schedule cron job for daily flag reset (runs at 00:00 UTC)
SELECT cron.schedule(
    'reset-daily-streak-flags',
    '0 0 * * *',
    $$
    SELECT reset_daily_streak_flags();
    $$
);
-- Schedule cron job for checking streak milestones (runs at 00:05 UTC)
SELECT cron.schedule(
    'check-streak-milestones',
    '5 0 * * *',
    $$
    SELECT net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/check-streak-milestones',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    )
    $$
);
