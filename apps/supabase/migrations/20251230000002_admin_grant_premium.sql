-- Allow super admins to manage subscriptions manually
-- This enables the "Grant Premium" feature in the admin dashboard

-- Allow super admins to insert new manual subscriptions
CREATE POLICY "Super admins can insert subscriptions"
    ON public.subscriptions FOR INSERT
    WITH CHECK (public.is_super_admin());

-- Allow super admins to update subscriptions (e.g. extending expiry)
CREATE POLICY "Super admins can update subscriptions"
    ON public.subscriptions FOR UPDATE
    USING (public.is_super_admin());

-- Allow super admins to delete subscriptions (e.g. revoking access)
CREATE POLICY "Super admins can delete subscriptions"
    ON public.subscriptions FOR DELETE
    USING (public.is_super_admin());
