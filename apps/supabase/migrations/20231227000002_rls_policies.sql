-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view partner profile"
  ON public.profiles FOR SELECT
  USING (
    couple_id IS NOT NULL AND
    couple_id IN (SELECT couple_id FROM public.profiles WHERE id = auth.uid())
  );

-- Couples policies
CREATE POLICY "Users can view own couple"
  ON public.couples FOR SELECT
  USING (id IN (SELECT couple_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Authenticated users can create couples"
  ON public.couples FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view couple by invite code"
  ON public.couples FOR SELECT
  USING (TRUE); -- Allow reading by invite_code for joining

-- Question packs policies (public packs visible to all)
CREATE POLICY "Anyone can view public packs"
  ON public.question_packs FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Premium users can view premium packs"
  ON public.question_packs FOR SELECT
  USING (
    is_premium = FALSE OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_premium = TRUE)
  );

-- Questions policies
CREATE POLICY "Anyone can view questions in visible packs"
  ON public.questions FOR SELECT
  USING (
    pack_id IN (
      SELECT id FROM public.question_packs 
      WHERE is_public = TRUE OR (
        is_premium = TRUE AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_premium = TRUE)
      )
    )
  );

-- Responses policies
CREATE POLICY "Users can view own responses"
  ON public.responses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own responses"
  ON public.responses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own responses"
  ON public.responses FOR UPDATE
  USING (user_id = auth.uid());

-- Matches policies
CREATE POLICY "Users can view couple matches"
  ON public.matches FOR SELECT
  USING (
    couple_id IN (SELECT couple_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update match seen status"
  ON public.matches FOR UPDATE
  USING (
    couple_id IN (SELECT couple_id FROM public.profiles WHERE id = auth.uid())
  );
