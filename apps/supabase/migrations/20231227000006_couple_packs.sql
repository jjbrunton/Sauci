-- Create couple_packs table to track enabled packs per couple
CREATE TABLE public.couple_packs (
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES public.question_packs(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (couple_id, pack_id)
);

-- RLS Policies
ALTER TABLE public.couple_packs ENABLE ROW LEVEL SECURITY;

-- Couples can view their own pack settings
CREATE POLICY "Couples can view their own pack settings"
  ON public.couple_packs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.couple_id = couple_packs.couple_id
    )
  );

-- Couples can insert/update their own pack settings
CREATE POLICY "Couples can modify their own pack settings"
  ON public.couple_packs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.couple_id = couple_packs.couple_id
    )
  );

-- Function to handle default packs for new couples (Optional, but good UX)
-- For now, we'll just assume if no record exists, it's not enabled? 
-- Or maybe better: if no record exists, it IS enabled if it's not premium?
-- Actually, the user wants to "select which packs are active".
-- Let's stick to explicit records.
