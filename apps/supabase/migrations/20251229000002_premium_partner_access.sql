-- Update RLS policies to allow partner premium access
-- When either user OR their partner has is_premium = TRUE, both can access premium packs

-- Drop existing premium pack policy
DROP POLICY IF EXISTS "Premium users can view premium packs" ON public.question_packs;

-- Create new policy that checks couple premium status
-- Access granted if: pack is not premium OR user is premium OR partner is premium
CREATE POLICY "Users or partners with premium can view premium packs"
  ON public.question_packs FOR SELECT
  USING (
    is_premium = FALSE OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.is_premium = TRUE OR
        EXISTS (
          SELECT 1 FROM public.profiles partner
          WHERE partner.couple_id = p.couple_id
          AND partner.couple_id IS NOT NULL
          AND partner.id != p.id
          AND partner.is_premium = TRUE
        )
      )
    )
  );

-- Update questions policy similarly
DROP POLICY IF EXISTS "Anyone can view questions in visible packs" ON public.questions;

CREATE POLICY "Users can view questions in accessible packs"
  ON public.questions FOR SELECT
  USING (
    pack_id IN (
      SELECT qp.id FROM public.question_packs qp
      WHERE qp.is_public = TRUE
      AND (
        qp.is_premium = FALSE OR
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND (
            p.is_premium = TRUE OR
            EXISTS (
              SELECT 1 FROM public.profiles partner
              WHERE partner.couple_id = p.couple_id
              AND partner.couple_id IS NOT NULL
              AND partner.id != p.id
              AND partner.is_premium = TRUE
            )
          )
        )
      )
    )
  );

-- Create a helper function to check premium access for a user
-- This can be used in application code and other policies
CREATE OR REPLACE FUNCTION public.has_premium_access(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_premium BOOLEAN;
  partner_premium BOOLEAN;
  user_couple_id UUID;
BEGIN
  -- Get user's premium status and couple_id
  SELECT is_premium, couple_id INTO user_premium, user_couple_id
  FROM public.profiles
  WHERE id = check_user_id;

  -- If user is premium, return true
  IF user_premium = TRUE THEN
    RETURN TRUE;
  END IF;

  -- If user has no couple, return false
  IF user_couple_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if partner is premium
  SELECT is_premium INTO partner_premium
  FROM public.profiles
  WHERE couple_id = user_couple_id
  AND id != check_user_id
  LIMIT 1;

  RETURN COALESCE(partner_premium, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
