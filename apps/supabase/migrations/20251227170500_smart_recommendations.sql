CREATE OR REPLACE FUNCTION public.get_recommended_questions(target_pack_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  text TEXT,
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
    -- Case 0: Specific pack requested
    SELECT target_pack_id AS pack_id 
    WHERE target_pack_id IS NOT NULL

    UNION ALL

    -- Case 1: No specific pack, config exists -> use enabled packs
    SELECT cp.pack_id 
    FROM public.couple_packs cp
    WHERE target_pack_id IS NULL
    AND cp.couple_id = v_couple_id AND cp.enabled = TRUE
    AND EXISTS (SELECT 1 FROM user_config_exists)
    
    UNION ALL
    
    -- Case 2: No specific pack, no config -> use all public packs
    SELECT p.id AS pack_id 
    FROM public.question_packs p
    WHERE target_pack_id IS NULL
    AND p.is_public = TRUE
    AND NOT EXISTS (SELECT 1 FROM user_config_exists)
  )
  SELECT 
    q.id,
    q.text,
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
