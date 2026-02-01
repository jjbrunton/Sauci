-- Allow super admins to read live draw sessions
CREATE POLICY "Admins can view all drawings"
  ON live_draw_sessions FOR SELECT
  USING (is_super_admin());
