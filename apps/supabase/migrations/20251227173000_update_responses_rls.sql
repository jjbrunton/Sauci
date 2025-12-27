-- Allow users to view their partner's responses in addition to their own
DROP POLICY IF EXISTS "Users can view own responses" ON public.responses;

CREATE POLICY "Users can view couple responses"
  ON public.responses FOR SELECT
  USING (
    user_id = auth.uid() OR
    couple_id IN (SELECT couple_id FROM public.profiles WHERE id = auth.uid())
  );
