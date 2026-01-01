-- Add RLS policies for redemption codes

CREATE POLICY "Admins with manage_codes permission can view redemption codes"
  ON redemption_codes FOR SELECT
  USING (has_permission('manage_codes'));

CREATE POLICY "Admins with manage_codes permission can insert redemption codes"
  ON redemption_codes FOR INSERT
  WITH CHECK (has_permission('manage_codes'));

CREATE POLICY "Admins with manage_codes permission can update redemption codes"
  ON redemption_codes FOR UPDATE
  USING (has_permission('manage_codes'));

CREATE POLICY "Admins with manage_codes permission can delete redemption codes"
  ON redemption_codes FOR DELETE
  USING (has_permission('manage_codes'));
