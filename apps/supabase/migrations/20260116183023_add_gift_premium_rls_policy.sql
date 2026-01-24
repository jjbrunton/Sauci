-- Add RLS policy for admins with gift_premium permission to insert subscriptions
CREATE POLICY "Admins with gift_premium can insert subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (has_permission('gift_premium'));
