-- Fix answer gap deadlock by calculating NET gap instead of independent gaps
-- Also add ORDER BY to get_recommended_questions to prioritize partner-answered questions

-- ============================================================================
-- Part 1: Fix get_answer_gap_status() to calculate NET gap
-- ============================================================================
--
-- Problem: Both partners can be "ahead" simultaneously when they answer different questions
-- Example: User A answers Q1-Q10, User B answers Q11-Q20
-- - Old: Both have gap=10, both blocked (deadlock!)
-- - New: Both have net_gap=0, neither blocked
--
-- NET gap = (questions I answered that partner hasn't) - (questions partner answered that I haven't)
-- Only positive values mean user is truly ahead

CREATE OR REPLACE FUNCTION get_answer_gap_status()
RETURNS TABLE(
    unanswered_by_partner integer,
    threshold integer,
    is_blocked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_couple_id UUID;
    v_partner_id UUID;
    v_my_unanswered integer;
    v_partner_unanswered integer;
    v_net_gap integer;
    v_threshold integer;
BEGIN
    v_user_id := auth.uid();

    -- Get user's couple_id
    SELECT p.couple_id INTO v_couple_id
    FROM profiles p
    WHERE p.id = v_user_id;

    -- No couple = no blocking needed
    IF v_couple_id IS NULL THEN
        RETURN QUERY SELECT 0, 0, false;
        RETURN;
    END IF;

    -- Get partner's ID
    SELECT p.id INTO v_partner_id
    FROM profiles p
    WHERE p.couple_id = v_couple_id AND p.id != v_user_id
    LIMIT 1;

    -- No partner = no blocking needed
    IF v_partner_id IS NULL THEN
        RETURN QUERY SELECT 0, 0, false;
        RETURN;
    END IF;

    -- Get threshold from app_config
    SELECT COALESCE(ac.answer_gap_threshold, 10) INTO v_threshold
    FROM app_config ac
    LIMIT 1;

    -- If threshold is 0, feature is disabled
    IF v_threshold = 0 THEN
        RETURN QUERY SELECT 0, 0, false;
        RETURN;
    END IF;

    -- Calculate NET gap to prevent deadlocks
    WITH enabled_packs AS (
        -- Get packs that the couple has explicitly enabled
        SELECT cp.pack_id
        FROM couple_packs cp
        WHERE cp.couple_id = v_couple_id AND cp.enabled = true
    )
    SELECT
        -- Questions I answered that partner hasn't
        COALESCE(SUM(CASE WHEN r.user_id = v_user_id AND NOT EXISTS (
            SELECT 1 FROM responses pr
            WHERE pr.question_id = r.question_id
            AND pr.user_id = v_partner_id
        ) THEN 1 ELSE 0 END), 0)::integer,
        -- Questions partner answered that I haven't
        COALESCE(SUM(CASE WHEN r.user_id = v_partner_id AND NOT EXISTS (
            SELECT 1 FROM responses pr
            WHERE pr.question_id = r.question_id
            AND pr.user_id = v_user_id
        ) THEN 1 ELSE 0 END), 0)::integer
    INTO v_my_unanswered, v_partner_unanswered
    FROM responses r
    INNER JOIN questions q ON q.id = r.question_id
    WHERE r.couple_id = v_couple_id
    AND r.user_id IN (v_user_id, v_partner_id)
    AND EXISTS (SELECT 1 FROM enabled_packs)
    AND q.pack_id IN (SELECT pack_id FROM enabled_packs);

    -- Net gap: only positive values mean user is truly ahead
    -- If partner has answered more, user's net gap is 0 (they're behind or even)
    v_net_gap := GREATEST(0, v_my_unanswered - v_partner_unanswered);

    -- Return net gap (displayed as "unanswered_by_partner" for backwards compatibility)
    RETURN QUERY SELECT v_net_gap, v_threshold, (v_net_gap >= v_threshold);
END;
$$;

COMMENT ON FUNCTION get_answer_gap_status() IS 'Returns answer gap status using NET gap calculation. Prevents deadlocks when both partners answer different questions.';

-- ============================================================================
-- Part 2: Update get_recommended_questions() to prioritize partner-answered questions
-- ============================================================================
--
-- Add ORDER BY to ensure:
-- 1. Questions partner has already answered come first (helps resolve gaps)
-- 2. Lower intensity questions shown first within each group

CREATE OR REPLACE FUNCTION get_recommended_questions(target_pack_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  text TEXT,
  partner_text TEXT,
  is_two_part BOOLEAN,
  pack_id UUID,
  intensity INTEGER,
  partner_answered BOOLEAN,
  allowed_couple_genders TEXT[],
  target_user_genders TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_couple_id UUID;
  v_partner_id UUID;
  v_user_gender TEXT;
  v_partner_gender TEXT;
  v_couple_type TEXT;
  v_has_premium BOOLEAN;
  v_gap_threshold INTEGER;
  v_my_unanswered INTEGER;
  v_partner_unanswered INTEGER;
  v_net_gap INTEGER;
  v_user_max_intensity INTEGER;
  v_daily_limit INTEGER;
  v_daily_count INTEGER;
  v_today_start TIMESTAMPTZ;
  v_tomorrow_start TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();

  SELECT p.couple_id, p.gender, COALESCE(p.max_intensity, 5)
  INTO v_couple_id, v_user_gender, v_user_max_intensity
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.id, p.gender INTO v_partner_id, v_partner_gender
  FROM public.profiles p
  WHERE p.couple_id = v_couple_id AND p.id != v_user_id
  LIMIT 1;

  -- Check premium access (used for both answer gap and daily limit)
  v_has_premium := public.has_premium_access(v_user_id);

  -- Check daily response limit (only when not browsing a specific pack and user is non-premium)
  IF v_partner_id IS NOT NULL AND target_pack_id IS NULL AND NOT v_has_premium THEN
    -- Get daily limit from app_config
    SELECT COALESCE(ac.daily_response_limit, 0) INTO v_daily_limit
    FROM app_config ac
    LIMIT 1;

    -- If daily limit > 0, check if user has reached it
    IF v_daily_limit > 0 THEN
      -- Calculate UTC day boundaries
      v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
      v_tomorrow_start := v_today_start + INTERVAL '1 day';

      -- Count responses created today (UTC)
      SELECT COUNT(*)::INTEGER INTO v_daily_count
      FROM responses r
      WHERE r.user_id = v_user_id
      AND r.created_at >= v_today_start
      AND r.created_at < v_tomorrow_start;

      -- If over daily limit, return empty (old apps see "All caught up!")
      IF v_daily_count >= v_daily_limit THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Check answer gap threshold using NET gap (only when not browsing a specific pack)
  IF v_partner_id IS NOT NULL AND target_pack_id IS NULL THEN
    -- Get threshold from app_config
    SELECT COALESCE(ac.answer_gap_threshold, 10) INTO v_gap_threshold
    FROM app_config ac
    LIMIT 1;

    -- If threshold > 0, check the NET gap
    IF v_gap_threshold > 0 THEN
      -- Calculate NET gap to prevent deadlocks
      WITH enabled_packs AS (
        SELECT cp.pack_id
        FROM couple_packs cp
        WHERE cp.couple_id = v_couple_id AND cp.enabled = true
      )
      SELECT
        -- Questions I answered that partner hasn't
        COALESCE(SUM(CASE WHEN r.user_id = v_user_id AND NOT EXISTS (
            SELECT 1 FROM responses pr
            WHERE pr.question_id = r.question_id
            AND pr.user_id = v_partner_id
        ) THEN 1 ELSE 0 END), 0)::integer,
        -- Questions partner answered that I haven't
        COALESCE(SUM(CASE WHEN r.user_id = v_partner_id AND NOT EXISTS (
            SELECT 1 FROM responses pr
            WHERE pr.question_id = r.question_id
            AND pr.user_id = v_user_id
        ) THEN 1 ELSE 0 END), 0)::integer
      INTO v_my_unanswered, v_partner_unanswered
      FROM responses r
      INNER JOIN questions q ON q.id = r.question_id
      WHERE r.couple_id = v_couple_id
      AND r.user_id IN (v_user_id, v_partner_id)
      AND EXISTS (SELECT 1 FROM enabled_packs)
      AND q.pack_id IN (SELECT ep.pack_id FROM enabled_packs ep);

      -- Net gap: only positive values mean user is truly ahead
      v_net_gap := GREATEST(0, v_my_unanswered - v_partner_unanswered);

      -- If over threshold, return empty (old apps see "All caught up!")
      IF v_net_gap >= v_gap_threshold THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  IF v_user_gender IS NOT NULL AND v_partner_gender IS NOT NULL THEN
      IF v_user_gender < v_partner_gender THEN
        v_couple_type := v_user_gender || '+' || v_partner_gender;
      ELSE
        v_couple_type := v_partner_gender || '+' || v_user_gender;
      END IF;
  END IF;

  RETURN QUERY
  WITH user_config_exists AS (
    SELECT 1 FROM public.couple_packs WHERE couple_id = v_couple_id LIMIT 1
  ),
  active_packs AS (
    SELECT target_pack_id AS pack_id
    WHERE target_pack_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.question_packs qp
      WHERE qp.id = target_pack_id
      AND (qp.is_premium = FALSE OR v_has_premium = TRUE)
    )
    UNION ALL
    SELECT cp.pack_id FROM public.couple_packs cp
    INNER JOIN public.question_packs qp ON qp.id = cp.pack_id
    WHERE target_pack_id IS NULL
    AND cp.couple_id = v_couple_id
    AND cp.enabled = TRUE
    AND (qp.is_premium = FALSE OR v_has_premium = TRUE)
    AND EXISTS (SELECT 1 FROM user_config_exists)
    UNION ALL
    SELECT p.id AS pack_id FROM public.question_packs p
    WHERE target_pack_id IS NULL
    AND p.is_public = TRUE
    AND (p.is_premium = FALSE OR v_has_premium = TRUE)
    AND NOT EXISTS (SELECT 1 FROM user_config_exists)
  )
  SELECT
    q.id,
    CASE
      WHEN q.partner_text IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.responses r
        WHERE r.question_id = q.id
        AND r.couple_id = v_couple_id
        AND r.user_id != v_user_id
      ) THEN q.partner_text
      ELSE q.text
    END as text,
    q.partner_text,
    q.partner_text IS NOT NULL as is_two_part,
    q.pack_id,
    q.intensity,
    EXISTS (
      SELECT 1 FROM public.responses r
      WHERE r.question_id = q.id
      AND r.couple_id = v_couple_id
      AND r.user_id != v_user_id
    ) AS partner_answered,
    q.allowed_couple_genders,
    q.target_user_genders
  FROM public.questions q
  WHERE q.pack_id IN (SELECT ap.pack_id FROM active_packs ap)
  AND NOT EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.question_id = q.id
    AND r.user_id = v_user_id
  )
  AND (
    q.allowed_couple_genders IS NULL
    OR v_couple_type IS NULL
    OR v_couple_type = ANY(q.allowed_couple_genders)
  )
  AND (
    q.target_user_genders IS NULL
    OR v_user_gender = ANY(q.target_user_genders)
    OR EXISTS (
      SELECT 1 FROM public.responses r
      WHERE r.question_id = q.id
      AND r.couple_id = v_couple_id
      AND r.user_id != v_user_id
    )
  )
  -- Filter by user's max_intensity preference
  AND (
    q.intensity IS NULL
    OR q.intensity <= v_user_max_intensity
  )
  -- ORDER BY: Partner-answered questions first to help resolve gaps, then by intensity
  ORDER BY
    EXISTS (
      SELECT 1 FROM public.responses r
      WHERE r.question_id = q.id
      AND r.couple_id = v_couple_id
      AND r.user_id != v_user_id
    ) DESC,
    q.intensity ASC;
END;
$$;

COMMENT ON FUNCTION get_recommended_questions(UUID) IS 'Returns recommended questions prioritizing partner-answered questions first to prevent deadlocks. Uses NET gap calculation for blocking.';
