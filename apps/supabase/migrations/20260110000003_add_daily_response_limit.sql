-- Add daily response limit for non-premium users
-- This feature limits how many questions a non-premium user can answer per UTC day

-- Add daily_response_limit column to app_config
ALTER TABLE app_config
ADD COLUMN daily_response_limit INTEGER DEFAULT 0;

COMMENT ON COLUMN app_config.daily_response_limit IS 'Maximum number of questions a non-premium user can answer per UTC day. Set to 0 to disable daily limits.';

-- ============================================================================
-- RPC FUNCTION: get_daily_response_limit_status
-- Returns the current daily response limit status for the authenticated user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_response_limit_status()
RETURNS TABLE(
    responses_today INTEGER,
    limit_value INTEGER,
    remaining INTEGER,
    reset_at TIMESTAMPTZ,
    is_blocked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_has_premium BOOLEAN;
    v_limit INTEGER;
    v_count INTEGER;
    v_today_start TIMESTAMPTZ;
    v_tomorrow_start TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();

    -- Get limit from app_config
    SELECT COALESCE(ac.daily_response_limit, 0) INTO v_limit
    FROM app_config ac
    LIMIT 1;

    -- If limit is 0, feature is disabled
    IF v_limit = 0 THEN
        RETURN QUERY SELECT 0, 0, 0, NULL::TIMESTAMPTZ, false;
        RETURN;
    END IF;

    -- Check if user has premium access (user or partner)
    v_has_premium := public.has_premium_access(v_user_id);

    -- Premium users bypass the limit
    IF v_has_premium THEN
        RETURN QUERY SELECT 0, 0, 0, NULL::TIMESTAMPTZ, false;
        RETURN;
    END IF;

    -- Calculate UTC day boundaries
    v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_tomorrow_start := v_today_start + INTERVAL '1 day';

    -- Count responses created today (UTC)
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM responses r
    WHERE r.user_id = v_user_id
    AND r.created_at >= v_today_start
    AND r.created_at < v_tomorrow_start;

    RETURN QUERY SELECT 
        v_count,
        v_limit,
        GREATEST(0, v_limit - v_count),
        v_tomorrow_start,
        (v_count >= v_limit);
END;
$$;

COMMENT ON FUNCTION get_daily_response_limit_status() IS 'Returns daily response limit status for the current user. Premium users and disabled limits return is_blocked=false.';
