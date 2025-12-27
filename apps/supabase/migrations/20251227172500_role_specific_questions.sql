-- Update get_recommended_questions to handle two-part questions role assignment
-- And return is_two_part for prioritization in the app
DROP FUNCTION IF EXISTS public.get_recommended_questions(uuid);

CREATE OR REPLACE FUNCTION public.get_recommended_questions(target_pack_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  text TEXT,
  partner_text TEXT, -- Keep this for reference if needed, but 'text' will be the display one
  is_two_part BOOLEAN,
  pack_id UUID,
  intensity INT,
  partner_answered BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_couple_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get couple_id
  SELECT p.couple_id INTO v_couple_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH user_config_exists AS (
    SELECT 1 FROM public.couple_packs WHERE couple_id = v_couple_id LIMIT 1
  ),
  active_packs AS (
    SELECT target_pack_id AS pack_id WHERE target_pack_id IS NOT NULL
    UNION ALL
    SELECT cp.pack_id FROM public.couple_packs cp
    WHERE target_pack_id IS NULL AND cp.couple_id = v_couple_id AND cp.enabled = TRUE
    AND EXISTS (SELECT 1 FROM user_config_exists)
    UNION ALL
    SELECT p.id AS pack_id FROM public.question_packs p
    WHERE target_pack_id IS NULL AND p.is_public = TRUE
    AND NOT EXISTS (SELECT 1 FROM user_config_exists)
  )
  SELECT 
    q.id,
    -- Logic: Show partner_text IF partner has already answered, otherwise show text
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
    ) AS partner_answered
  FROM public.questions q
  WHERE q.pack_id IN (SELECT ap.pack_id FROM active_packs ap)
  AND NOT EXISTS (
    SELECT 1 FROM public.responses r 
    WHERE r.question_id = q.id 
    AND r.user_id = v_user_id
  );
END;
$$;
