-- Update get_recommended_questions to return question_type and config for new question types
-- Must DROP first because we're changing the return type signature
DROP FUNCTION IF EXISTS public.get_recommended_questions(uuid);

CREATE OR REPLACE FUNCTION public.get_recommended_questions(target_pack_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, text text, partner_text text, is_two_part boolean, pack_id uuid, intensity integer, partner_answered boolean, allowed_couple_genders text[], target_user_genders text[], question_type question_type, config jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_partner_max_intensity INTEGER;
  v_effective_max_intensity INTEGER;
  v_use_couple_intensity_gate BOOLEAN;
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

  SELECT p.id, p.gender, COALESCE(p.max_intensity, 5)
  INTO v_partner_id, v_partner_gender, v_partner_max_intensity
  FROM public.profiles p
  WHERE p.couple_id = v_couple_id AND p.id != v_user_id
  LIMIT 1;

  -- Toggle: gate questions by couple-effective intensity
  SELECT COALESCE(ac.couple_intensity_gate_enabled, FALSE)
  INTO v_use_couple_intensity_gate
  FROM app_config ac
  LIMIT 1;

  v_use_couple_intensity_gate := COALESCE(v_use_couple_intensity_gate, FALSE);

  v_effective_max_intensity := CASE
    WHEN v_use_couple_intensity_gate AND v_partner_id IS NOT NULL THEN LEAST(v_user_max_intensity, v_partner_max_intensity)
    ELSE v_user_max_intensity
  END;

  -- Check premium access (used for both answer gap and daily limit)
  v_has_premium := public.has_premium_access(v_user_id);

  -- Check daily response limit (only when not browsing a specific pack and user is non-premium)
  IF v_partner_id IS NOT NULL AND target_pack_id IS NULL AND NOT v_has_premium THEN
    SELECT COALESCE(ac.daily_response_limit, 0) INTO v_daily_limit
    FROM app_config ac
    LIMIT 1;

    IF v_daily_limit > 0 THEN
      v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
      v_tomorrow_start := v_today_start + INTERVAL '1 day';

      SELECT COUNT(*)::INTEGER INTO v_daily_count
      FROM responses r
      WHERE r.user_id = v_user_id
      AND r.created_at >= v_today_start
      AND r.created_at < v_tomorrow_start;

      IF v_daily_count >= v_daily_limit THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Check answer gap threshold using NET gap (only when not browsing a specific pack)
  IF v_partner_id IS NOT NULL AND target_pack_id IS NULL THEN
    SELECT COALESCE(ac.answer_gap_threshold, 10) INTO v_gap_threshold
    FROM app_config ac
    LIMIT 1;

    IF v_gap_threshold > 0 THEN
      WITH enabled_packs AS (
        SELECT cp.pack_id
        FROM couple_packs cp
        WHERE cp.couple_id = v_couple_id AND cp.enabled = true
      )
      SELECT
        COALESCE(SUM(CASE WHEN r.user_id = v_user_id AND NOT EXISTS (
            SELECT 1 FROM responses pr
            WHERE pr.question_id = r.question_id
            AND pr.user_id = v_partner_id
        ) THEN 1 ELSE 0 END), 0)::integer,
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
      AND q.pack_id IN (SELECT ep.pack_id FROM enabled_packs ep)
      AND (
        NOT v_use_couple_intensity_gate
        OR q.intensity IS NULL
        OR q.intensity <= v_effective_max_intensity
      );

      v_net_gap := GREATEST(0, v_my_unanswered - v_partner_unanswered);

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
    q.target_user_genders,
    q.question_type,  -- NEW: Return question type
    q.config          -- NEW: Return question config
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
  AND (
    q.intensity IS NULL
    OR q.intensity <= v_effective_max_intensity
  )
  ORDER BY
    EXISTS (
      SELECT 1 FROM public.responses r
      WHERE r.question_id = q.id
      AND r.couple_id = v_couple_id
      AND r.user_id != v_user_id
    ) DESC,
    q.intensity ASC,
    q.id ASC;
END;
$function$;
