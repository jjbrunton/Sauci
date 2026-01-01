-- Add RLS policies for feedback

CREATE POLICY "Admins with manage_feedback permission can view all feedback"
  ON feedback FOR SELECT
  USING (has_permission('manage_feedback'));

CREATE POLICY "Admins with manage_feedback permission can update all feedback"
  ON feedback FOR UPDATE
  USING (has_permission('manage_feedback'));
