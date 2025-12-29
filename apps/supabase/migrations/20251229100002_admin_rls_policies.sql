-- Admin RLS Policies
-- Adds policies for admin access to tables

-- Question Packs: All admins can manage (CRUD)
CREATE POLICY "Admins can view all question packs"
    ON public.question_packs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can insert question packs"
    ON public.question_packs FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update question packs"
    ON public.question_packs FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete question packs"
    ON public.question_packs FOR DELETE
    USING (public.is_admin());

-- Questions: All admins can manage (CRUD)
CREATE POLICY "Admins can view all questions"
    ON public.questions FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can insert questions"
    ON public.questions FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update questions"
    ON public.questions FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete questions"
    ON public.questions FOR DELETE
    USING (public.is_admin());

-- Profiles: Super admins can view and update all
CREATE POLICY "Super admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_super_admin());

CREATE POLICY "Super admins can update all profiles"
    ON public.profiles FOR UPDATE
    USING (public.is_super_admin());

-- Couples: Super admins can view all
CREATE POLICY "Super admins can view all couples"
    ON public.couples FOR SELECT
    USING (public.is_super_admin());

-- Responses: Super admins can view all
CREATE POLICY "Super admins can view all responses"
    ON public.responses FOR SELECT
    USING (public.is_super_admin());

-- Matches: Super admins can view all
CREATE POLICY "Super admins can view all matches"
    ON public.matches FOR SELECT
    USING (public.is_super_admin());

-- Messages: Super admins can view all
CREATE POLICY "Super admins can view all messages"
    ON public.messages FOR SELECT
    USING (public.is_super_admin());

-- Subscriptions: Super admins can view all
CREATE POLICY "Super admins can view all subscriptions"
    ON public.subscriptions FOR SELECT
    USING (public.is_super_admin());

-- Feedback: Super admins can view and manage all
CREATE POLICY "Super admins can view all feedback"
    ON public.feedback FOR SELECT
    USING (public.is_super_admin());

CREATE POLICY "Super admins can update all feedback"
    ON public.feedback FOR UPDATE
    USING (public.is_super_admin());
