-- Allow admins to view all feature interest opt-ins

CREATE POLICY "Admins with view_users permission can view all feature interests"
  ON feature_interests FOR SELECT
  USING (has_permission('view_users'));
