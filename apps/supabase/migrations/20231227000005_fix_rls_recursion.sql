-- Fix infinite recursion in profiles RLS policy

-- Create a secure function to look up couple_id without triggering recursion
CREATE OR REPLACE FUNCTION public.get_auth_user_couple_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT couple_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view partner profile" ON public.profiles;

-- Recreate the policy using the secure function
CREATE POLICY "Users can view partner profile"
  ON public.profiles FOR SELECT
  USING (
    couple_id IS NOT NULL AND
    couple_id = public.get_auth_user_couple_id()
  );

-- Also fix the Matches policy which has the same issue
DROP POLICY IF EXISTS "Users can view couple matches" ON public.matches;

CREATE POLICY "Users can view couple matches"
  ON public.matches FOR SELECT
  USING (
    couple_id = public.get_auth_user_couple_id()
  );

-- And the update matches policy
DROP POLICY IF EXISTS "Users can update match seen status" ON public.matches;

CREATE POLICY "Users can update match seen status"
  ON public.matches FOR UPDATE
  USING (
    couple_id = public.get_auth_user_couple_id()
  );

-- And the Couples policy
DROP POLICY IF EXISTS "Users can view own couple" ON public.couples;

CREATE POLICY "Users can view own couple"
  ON public.couples FOR SELECT
  USING (
    id = public.get_auth_user_couple_id()
  );
