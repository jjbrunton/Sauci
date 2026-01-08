-- Filter individual questions by user's max_intensity preference
-- This fixes a bug where users would see intense questions despite having a gentle comfort zone

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
  v_gap_count INTEGER;
  v_user_max_intensity INTEGER;
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

  -- Check answer gap threshold (only when not browsing a specific pack)
  IF v_partner_id IS NOT NULL AND target_pack_id IS NULL THEN
    -- Get threshold from app_config
    SELECT COALESCE(ac.answer_gap_threshold, 10) INTO v_gap_threshold
    FROM app_config ac
    LIMIT 1;

    -- If threshold > 0, check the gap
    IF v_gap_threshold > 0 THEN
      -- Count questions in ENABLED packs where user answered but partner hasn't
      WITH enabled_packs AS (
        SELECT cp.pack_id
        FROM couple_packs cp
        WHERE cp.couple_id = v_couple_id AND cp.enabled = true
      )
      SELECT COUNT(*)::integer INTO v_gap_count
      FROM responses r
      INNER JOIN questions q ON q.id = r.question_id
      WHERE r.user_id = v_user_id
      AND r.couple_id = v_couple_id
      AND EXISTS (SELECT 1 FROM enabled_packs)
      AND q.pack_id IN (SELECT ep.pack_id FROM enabled_packs ep)
      AND NOT EXISTS (
        SELECT 1 FROM responses pr
        WHERE pr.question_id = r.question_id
        AND pr.user_id = v_partner_id
      );

      -- If over threshold, return empty (old apps see "All caught up!")
      IF v_gap_count >= v_gap_threshold THEN
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

  v_has_premium := public.has_premium_access(v_user_id);

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
  );
END;
$$;

COMMENT ON FUNCTION get_recommended_questions(UUID) IS 'Returns recommended questions for user filtered by their intensity preference. When user is too far ahead of partner (answer gap threshold exceeded), returns empty.';
