
-- Ensure gender column exists on profiles (if not already present)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN 
        ALTER TABLE public.profiles ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say')); 
    END IF; 
END $$;

-- Add allowed_couple_genders to questions
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS allowed_couple_genders TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.questions.allowed_couple_genders IS 'Array of allowed gender pairings (e.g., ["female+male", "female+female"]). Null means all allowed.';

-- Update get_recommended_questions to respect gender context
DROP FUNCTION IF EXISTS public.get_recommended_questions(uuid);

CREATE OR REPLACE FUNCTION public.get_recommended_questions(target_pack_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  text TEXT,
  pack_id UUID,
  intensity INT,
  partner_answered BOOLEAN,
  allowed_couple_genders TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_couple_id UUID;
  v_user_gender TEXT;
  v_partner_gender TEXT;
  v_couple_type TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Get user info including gender
  SELECT p.couple_id, p.gender INTO v_couple_id, v_user_gender
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  -- Get partner gender
  SELECT p.gender INTO v_partner_gender
  FROM public.profiles p
  WHERE p.couple_id = v_couple_id AND p.id != v_user_id
  LIMIT 1;

  -- Determine couple type
  IF v_user_gender IS NOT NULL AND v_partner_gender IS NOT NULL THEN
      -- Sort genders to create a consistent type string
      -- We assume binary genders for the primary logic as requested: male/male, male/female, female/female
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
    ) AS partner_answered,
    q.allowed_couple_genders
  FROM public.questions q
  WHERE q.pack_id IN (SELECT ap.pack_id FROM active_packs ap)
  AND (
      q.allowed_couple_genders IS NULL 
      OR v_couple_type IS NULL 
      OR v_couple_type = ANY(q.allowed_couple_genders)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.responses r 
    WHERE r.question_id = q.id 
    AND r.user_id = v_user_id
  );
END;
$$;
