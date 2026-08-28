-- Enforce the reviewed catalogue centrally so already-installed mobile clients
-- cannot retrieve unreviewed or archived curated content. Admin SELECT policies
-- remain separate and continue to expose the full review queue to administrators.

DO $$
BEGIN
  -- Fresh/local databases apply migrations before optional catalogue fixtures.
  -- Empty is valid; any non-empty catalogue must exactly match the audited
  -- production snapshot or the migration fails closed.
  IF (SELECT count(*) FROM public.categories) = 0
     AND (SELECT count(*) FROM public.question_packs) = 0
     AND (SELECT count(*) FROM public.questions) = 0
     AND (SELECT count(*) FROM public.dare_packs) = 0
     AND (SELECT count(*) FROM public.dares) = 0 THEN
    RETURN;
  END IF;

  IF (SELECT count(*) FROM public.categories) <> 15
     OR (SELECT count(*) FROM public.question_packs) <> 47
     OR (SELECT count(*) FROM public.questions) <> 2759
     OR (SELECT count(*) FROM public.dare_packs) <> 4
     OR (SELECT count(*) FROM public.dares) <> 28 THEN
    RAISE EXCEPTION 'Catalogue changed after the 2026-08-28 review; re-audit before enforcing';
  END IF;

  IF (SELECT count(*) FROM public.question_packs WHERE content_status = 'archived') <> 30
     OR (SELECT count(*) FROM public.question_packs WHERE content_status = 'unreviewed') <> 17
     OR (SELECT count(*) FROM public.questions WHERE content_status = 'archived') <> 2072
     OR (SELECT count(*) FROM public.questions WHERE content_status = 'unreviewed') <> 687 THEN
    RAISE EXCEPTION 'Catalogue review state changed after the 2026-08-28 review; re-audit before enforcing';
  END IF;
END;
$$;

-- Only neutral category labels which contain reviewed relationship/date packs
-- are exposed. Categories containing only archived material are archived too.
UPDATE public.categories
SET
  content_status = CASE
    WHEN id IN (
      'c1000000-0000-0000-0000-000000000002'::uuid, -- Adventure & Travel
      'fcb36b61-6081-4bf6-9267-1ba9ba75fc08'::uuid, -- Quality Time
      '43106c46-042a-4032-a663-8e8206273927'::uuid, -- Who is More Likely
      'ef425e8d-9fc4-40c2-a5e7-5fc4cb6b64da'::uuid, -- Social Life
      'ecabc509-9fed-48cb-bd60-c5d830d2491d'::uuid  -- Long Distance
    ) THEN 'allowed'::public.content_review_status
    ELSE 'archived'::public.content_review_status
  END,
  content_review_reason = CASE
    WHEN id IN (
      'c1000000-0000-0000-0000-000000000002'::uuid,
      'fcb36b61-6081-4bf6-9267-1ba9ba75fc08'::uuid,
      '43106c46-042a-4032-a663-8e8206273927'::uuid,
      'ef425e8d-9fc4-40c2-a5e7-5fc4cb6b64da'::uuid,
      'ecabc509-9fed-48cb-bd60-c5d830d2491d'::uuid
    ) THEN 'Reviewed neutral category for store-safe relationship content'
    ELSE 'Category contains no store-safe reviewed packs'
  END
WHERE content_status = 'unreviewed';

-- The fourteen reviewed non-explicit relationship/date packs are allowed.
-- Three explicit packs missed by the first conservative pass are archived.
WITH reviewed_allowed_packs(id) AS (
  VALUES
    ('7e9cb72e-95dd-4140-8d58-17206e6fe153'::uuid), -- Between the Lines
    ('8da8dcb1-0b9b-4828-9a30-199758b8ade5'::uuid), -- Date Night Ideas
    ('e11bdfea-ab07-46a9-952d-5c00c8b4ddbb'::uuid), -- Everyday Moments
    ('cf483ec0-502a-41ea-a2a2-2f223e7ec6ce'::uuid), -- Everyday Us
    ('877d8a39-5229-4263-bffc-d3043015603f'::uuid), -- Finding Your Vibe
    ('1d2ed912-1429-4045-a608-35b8db63f9b4'::uuid), -- Food & Culture
    ('45ff272c-be6d-4faa-a932-a5285a19afe6'::uuid), -- Growing Together
    ('d6128ed8-e209-43db-88eb-e9d0115ba8d7'::uuid), -- Hosting
    ('1ec3f726-b495-423b-a5dc-60f5178fdf21'::uuid), -- Our Future
    ('0f2b3400-05d4-40db-b8fa-41c92ab877eb'::uuid), -- Outdoor Explorers
    ('48150d71-bf95-49b0-924f-e9bcff63fc03'::uuid), -- Relationship Essentials
    ('fd6f2a49-1057-4f30-aab4-7cd185764f7e'::uuid), -- Staying Close
    ('aea8bb8f-de02-41ad-bd1f-7616780dde30'::uuid), -- Weekend Adventures (empty)
    ('91dacfed-46ae-462d-aae3-5e540fe4a973'::uuid)  -- Weekend Warriors
)
UPDATE public.question_packs qp
SET
  content_status = CASE
    WHEN rap.id IS NOT NULL THEN 'allowed'::public.content_review_status
    ELSE 'archived'::public.content_review_status
  END,
  content_review_reason = CASE
    WHEN rap.id IS NOT NULL
      THEN 'Reviewed as non-explicit relationship, conversation, or date content'
    ELSE 'Explicit pack identified during final enforcement review'
  END
FROM (SELECT id FROM public.question_packs WHERE content_status = 'unreviewed') pending
LEFT JOIN reviewed_allowed_packs rap ON rap.id = pending.id
WHERE qp.id = pending.id;

-- Every question inherits its reviewed pack decision except one suggestive
-- shower prompt, which is archived individually from an otherwise safe pack.
UPDATE public.questions q
SET
  content_status = CASE
    WHEN qp.content_status = 'allowed'
      AND q.id <> '8d49681a-4b27-445e-9fda-915a3a7d7f5c'::uuid
      THEN 'allowed'::public.content_review_status
    ELSE 'archived'::public.content_review_status
  END,
  content_review_reason = CASE
    WHEN qp.content_status = 'allowed'
      AND q.id <> '8d49681a-4b27-445e-9fda-915a3a7d7f5c'::uuid
      THEN 'Reviewed with its store-safe relationship pack'
    WHEN q.id = '8d49681a-4b27-445e-9fda-915a3a7d7f5c'::uuid
      THEN 'Suggestive shower prompt archived during final enforcement review'
    ELSE 'Archived with explicit pack during final enforcement review'
  END
FROM public.question_packs qp
WHERE q.pack_id = qp.id
  AND q.content_status = 'unreviewed';

-- Keep only the plainly romantic dare pack. The remaining packs contain sexual,
-- suggestive, dominance, or fantasy prompts and are archived as complete packs.
UPDATE public.dare_packs
SET
  content_status = CASE
    WHEN id = 'a1b2c3d4-1111-1111-1111-111111111111'::uuid
      THEN 'allowed'::public.content_review_status
    ELSE 'archived'::public.content_review_status
  END,
  content_review_reason = CASE
    WHEN id = 'a1b2c3d4-1111-1111-1111-111111111111'::uuid
      THEN 'Reviewed as non-sexual romantic gestures'
    ELSE 'Pack contains suggestive, sexual, dominance, or fantasy dares'
  END
WHERE content_status = 'unreviewed';

UPDATE public.dares d
SET
  content_status = CASE
    WHEN dp.content_status = 'allowed' THEN 'allowed'::public.content_review_status
    ELSE 'archived'::public.content_review_status
  END,
  content_review_reason = CASE
    WHEN dp.content_status = 'allowed' THEN 'Reviewed with Romantic Gestures pack'
    ELSE 'Archived with non-store-safe dare pack'
  END
FROM public.dare_packs dp
WHERE d.pack_id = dp.id
  AND d.content_status = 'unreviewed';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.categories) = 0
     AND (SELECT count(*) FROM public.question_packs) = 0
     AND (SELECT count(*) FROM public.questions) = 0
     AND (SELECT count(*) FROM public.dare_packs) = 0
     AND (SELECT count(*) FROM public.dares) = 0 THEN
    RETURN;
  END IF;

  IF (SELECT count(*) FROM public.categories WHERE content_status = 'allowed') <> 5
     OR (SELECT count(*) FROM public.categories WHERE content_status = 'archived') <> 10
     OR (SELECT count(*) FROM public.question_packs WHERE content_status = 'allowed') <> 14
     OR (SELECT count(*) FROM public.question_packs WHERE content_status = 'archived') <> 33
     OR (SELECT count(*) FROM public.questions WHERE content_status = 'allowed') <> 591
     OR (SELECT count(*) FROM public.questions WHERE content_status = 'archived') <> 2168
     OR (SELECT count(*) FROM public.dare_packs WHERE content_status = 'allowed') <> 1
     OR (SELECT count(*) FROM public.dare_packs WHERE content_status = 'archived') <> 3
     OR (SELECT count(*) FROM public.dares WHERE content_status = 'allowed') <> 7
     OR (SELECT count(*) FROM public.dares WHERE content_status = 'archived') <> 21
     OR EXISTS (
       SELECT 1 FROM public.question_packs qp
       LEFT JOIN public.categories c ON c.id = qp.category_id
       WHERE qp.content_status = 'allowed'
         AND qp.category_id IS NOT NULL
         AND c.content_status <> 'allowed'
     )
     OR EXISTS (
       SELECT 1 FROM public.questions q
       JOIN public.question_packs qp ON qp.id = q.pack_id
       WHERE q.content_status = 'allowed' AND qp.content_status <> 'allowed'
     ) THEN
    RAISE EXCEPTION 'Reviewed catalogue does not match the approved enforcement set';
  END IF;
END;
$$;

-- Remove archived packs from existing couples' active recommendation sets.
-- Suppress the ordinary partner-notification trigger because this is a global
-- policy cutover, not a user-initiated pack preference change.
CREATE TEMP TABLE catalogue_cutover_couples ON COMMIT DROP AS
SELECT DISTINCT cp.couple_id
FROM public.couple_packs cp
JOIN public.question_packs qp ON qp.id = cp.pack_id
WHERE cp.enabled = true
  AND qp.content_status <> 'allowed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.couple_packs enabled_cp
    JOIN public.question_packs enabled_qp ON enabled_qp.id = enabled_cp.pack_id
    WHERE enabled_cp.couple_id = cp.couple_id
      AND enabled_cp.enabled = true
      AND enabled_qp.content_status = 'allowed'
  );

ALTER TABLE public.couple_packs DISABLE TRIGGER on_couple_pack_enabled;
UPDATE public.couple_packs cp
SET enabled = false
FROM public.question_packs qp
WHERE qp.id = cp.pack_id
  AND qp.content_status <> 'allowed'
  AND cp.enabled = true;

-- If the cutover removed a couple's entire active selection, seed the same
-- reviewed low-intensity defaults used for newly-created couples. Existing
-- allowed selections and intentional all-disabled configurations are untouched.
INSERT INTO public.couple_packs (couple_id, pack_id, enabled)
SELECT affected.couple_id, qp.id, true
FROM catalogue_cutover_couples affected
CROSS JOIN public.question_packs qp
WHERE qp.content_status = 'allowed'
  AND qp.is_public = true
  AND qp.avg_intensity <= 2
ON CONFLICT (couple_id, pack_id)
DO UPDATE SET enabled = EXCLUDED.enabled;

ALTER TABLE public.couple_packs ENABLE TRIGGER on_couple_pack_enabled;

-- RLS is the compatibility boundary for direct table queries made by existing
-- clients. Permissive admin policies remain in place and still expose all rows.
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (is_public = true AND content_status = 'allowed');

DROP POLICY IF EXISTS "Anyone can view public packs" ON public.question_packs;
CREATE POLICY "Anyone can view public packs"
  ON public.question_packs FOR SELECT
  USING (
    is_public = true
    AND content_status = 'allowed'
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id = question_packs.category_id
          AND c.is_public = true
          AND c.content_status = 'allowed'
      )
    )
  );

-- This older permissive policy made free non-public packs readable and is
-- redundant with the public-pack policy for catalogue metadata.
DROP POLICY IF EXISTS "Premium users can view premium packs" ON public.question_packs;

DROP POLICY IF EXISTS "Anyone can view questions in visible packs" ON public.questions;
CREATE POLICY "Anyone can view questions in visible packs"
  ON public.questions FOR SELECT
  USING (
    content_status = 'allowed'
    AND EXISTS (
      SELECT 1
      FROM public.question_packs qp
      WHERE qp.id = questions.pack_id
        AND qp.is_public = true
        AND qp.content_status = 'allowed'
        AND (
          qp.category_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.categories c
            WHERE c.id = qp.category_id
              AND c.is_public = true
              AND c.content_status = 'allowed'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Public dare packs are viewable by everyone" ON public.dare_packs;
CREATE POLICY "Public dare packs are viewable by everyone"
  ON public.dare_packs FOR SELECT
  USING (
    is_public = true
    AND content_status = 'allowed'
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id = dare_packs.category_id
          AND c.is_public = true
          AND c.content_status = 'allowed'
      )
    )
  );

DROP POLICY IF EXISTS "Users can view dares in accessible packs" ON public.dares;
CREATE POLICY "Users can view dares in accessible packs"
  ON public.dares FOR SELECT
  USING (
    content_status = 'allowed'
    AND EXISTS (
      SELECT 1 FROM public.dare_packs dp
      WHERE dp.id = dares.pack_id
        AND dp.is_public = true
        AND dp.content_status = 'allowed'
        AND (
          dp.is_premium = false
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_premium = true
          )
        )
        AND (
          dp.category_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.categories c
            WHERE c.id = dp.category_id
              AND c.is_public = true
              AND c.content_status = 'allowed'
          )
        )
    )
  );

-- Hide historical match rows whose curated source question is no longer
-- eligible. Existing mobile queries use a left relationship, so filtering only
-- the nested question would otherwise leave a null-content match card behind.
DROP POLICY IF EXISTS "Users can view couple matches" ON public.matches;
CREATE POLICY "Users can view couple matches"
  ON public.matches FOR SELECT
  USING (
    couple_id = public.get_auth_user_couple_id()
    AND EXISTS (
      SELECT 1
      FROM public.questions q
      JOIN public.question_packs qp ON qp.id = q.pack_id
      LEFT JOIN public.categories c ON c.id = qp.category_id
      WHERE q.id = matches.question_id
        AND q.content_status = 'allowed'
        AND qp.content_status = 'allowed'
        AND (qp.category_id IS NULL OR c.content_status = 'allowed')
    )
  );

-- Existing clients may write couple_packs directly. Prevent a stale client from
-- re-enabling an archived pack, while preserving deletion of old preference rows.
DROP POLICY IF EXISTS "Couples can view their own pack settings" ON public.couple_packs;
CREATE POLICY "Couples can view their own pack settings"
  ON public.couple_packs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.couple_id = couple_packs.couple_id
    )
    AND EXISTS (
      SELECT 1 FROM public.question_packs qp
      WHERE qp.id = couple_packs.pack_id AND qp.content_status = 'allowed'
    )
  );

DROP POLICY IF EXISTS "Couples can modify their own pack settings" ON public.couple_packs;
CREATE POLICY "Couples can insert allowed pack settings"
  ON public.couple_packs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.couple_id = couple_packs.couple_id
    )
    AND EXISTS (
      SELECT 1 FROM public.question_packs qp
      WHERE qp.id = couple_packs.pack_id AND qp.content_status = 'allowed'
    )
  );

CREATE POLICY "Couples can update allowed pack settings"
  ON public.couple_packs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.couple_id = couple_packs.couple_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.couple_id = couple_packs.couple_id
    )
    AND EXISTS (
      SELECT 1 FROM public.question_packs qp
      WHERE qp.id = couple_packs.pack_id AND qp.content_status = 'allowed'
    )
  );

-- Wrap SECURITY DEFINER catalogue RPCs rather than relying on RLS, which their
-- owner privileges bypass. The original implementations retain all recommendation
-- behavior but are no longer executable by API roles.
ALTER FUNCTION public.get_recommended_questions(uuid)
  RENAME TO get_recommended_questions_before_content_enforcement;
REVOKE ALL ON FUNCTION public.get_recommended_questions_before_content_enforcement(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_recommended_questions(target_pack_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  id uuid,
  text text,
  partner_text text,
  is_two_part boolean,
  pack_id uuid,
  intensity integer,
  partner_answered boolean,
  allowed_couple_genders text[],
  target_user_genders text[],
  question_type public.question_type,
  config jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT candidate.*
  FROM public.get_recommended_questions_before_content_enforcement(target_pack_id) candidate
  JOIN public.questions q ON q.id = candidate.id
  JOIN public.question_packs qp ON qp.id = q.pack_id
  LEFT JOIN public.categories c ON c.id = qp.category_id
  WHERE q.content_status = 'allowed'
    AND qp.content_status = 'allowed'
    AND (qp.category_id IS NULL OR c.content_status = 'allowed');
$$;
REVOKE ALL ON FUNCTION public.get_recommended_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recommended_questions(uuid) TO anon, authenticated, service_role;

ALTER FUNCTION public.get_pack_teaser_questions(uuid)
  RENAME TO get_pack_teaser_questions_before_content_enforcement;
REVOKE ALL ON FUNCTION public.get_pack_teaser_questions_before_content_enforcement(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_pack_teaser_questions(target_pack_id uuid)
RETURNS TABLE(id uuid, text text, intensity integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT candidate.*
  FROM public.get_pack_teaser_questions_before_content_enforcement(target_pack_id) candidate
  JOIN public.questions q ON q.id = candidate.id
  JOIN public.question_packs qp ON qp.id = q.pack_id
  LEFT JOIN public.categories c ON c.id = qp.category_id
  WHERE q.content_status = 'allowed'
    AND qp.content_status = 'allowed'
    AND (qp.category_id IS NULL OR c.content_status = 'allowed');
$$;
REVOKE ALL ON FUNCTION public.get_pack_teaser_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pack_teaser_questions(uuid) TO anon, authenticated, service_role;
