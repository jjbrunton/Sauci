-- Add visibility toggle for categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Categories: hide non-public categories from non-admins
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (is_public = true);

-- Question packs: require public categories for visibility
DROP POLICY IF EXISTS "Anyone can view public packs" ON public.question_packs;
CREATE POLICY "Anyone can view public packs"
  ON public.question_packs FOR SELECT
  USING (
    is_public = true
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories c
        WHERE c.id = question_packs.category_id
          AND c.is_public = true
      )
    )
  );

DROP POLICY IF EXISTS "Premium users can view premium packs" ON public.question_packs;
CREATE POLICY "Premium users can view premium packs"
  ON public.question_packs FOR SELECT
  USING (
    (is_premium = false OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_premium = true
    ))
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories c
        WHERE c.id = question_packs.category_id
          AND c.is_public = true
      )
    )
  );

-- Questions: require visible packs and public categories
DROP POLICY IF EXISTS "Anyone can view questions in visible packs" ON public.questions;
CREATE POLICY "Anyone can view questions in visible packs"
  ON public.questions FOR SELECT
  USING (
    pack_id IN (
      SELECT id FROM public.question_packs
      WHERE (
        is_public = true
        OR (is_premium = true AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.is_premium = true
        ))
      )
      AND (
        category_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.categories c
          WHERE c.id = question_packs.category_id
            AND c.is_public = true
        )
      )
    )
  );

-- Ensure recommendation queries honor category visibility
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
  v_user_gender TEXT;
  v_partner_gender TEXT;
  v_couple_type TEXT;
  v_has_premium BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT p.couple_id, p.gender INTO v_couple_id, v_user_gender
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.gender INTO v_partner_gender
  FROM public.profiles p
  WHERE p.couple_id = v_couple_id AND p.id != v_user_id
  LIMIT 1;

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
      AND (
        qp.category_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.categories c
          WHERE c.id = qp.category_id
            AND c.is_public = TRUE
        )
      )
    )
    UNION ALL
    SELECT cp.pack_id FROM public.couple_packs cp
    INNER JOIN public.question_packs qp ON qp.id = cp.pack_id
    WHERE target_pack_id IS NULL
    AND cp.couple_id = v_couple_id
    AND cp.enabled = TRUE
    AND (qp.is_premium = FALSE OR v_has_premium = TRUE)
    AND (
      qp.category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories c
        WHERE c.id = qp.category_id
          AND c.is_public = TRUE
      )
    )
    AND EXISTS (SELECT 1 FROM user_config_exists)
    UNION ALL
    SELECT p.id AS pack_id FROM public.question_packs p
    WHERE target_pack_id IS NULL
    AND p.is_public = TRUE
    AND (p.is_premium = FALSE OR v_has_premium = TRUE)
    AND (
      p.category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories c
        WHERE c.id = p.category_id
          AND c.is_public = TRUE
      )
    )
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
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_pack_teaser_questions(target_pack_id UUID)
RETURNS TABLE(id UUID, text TEXT, intensity INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.text,
    q.intensity
  FROM public.questions q
  INNER JOIN public.question_packs qp ON qp.id = q.pack_id
  WHERE q.pack_id = target_pack_id
  AND qp.is_public = TRUE
  AND (
    qp.category_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = qp.category_id
        AND c.is_public = TRUE
    )
  )
  ORDER BY q.intensity ASC, random()
  LIMIT 3;
END;
$$;
