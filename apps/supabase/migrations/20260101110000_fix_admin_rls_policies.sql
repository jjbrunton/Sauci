-- Function to check for specific permission
CREATE OR REPLACE FUNCTION has_permission(check_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_role admin_role;
    v_permissions JSONB;
BEGIN
    SELECT role, permissions INTO v_role, v_permissions
    FROM public.admin_users
    WHERE user_id = auth.uid();

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- Check if permissions array contains the required permission
    -- Using the @> operator to check if the JSON array contains the value
    IF v_permissions IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN v_permissions @> jsonb_build_array(check_permission);
END;
$$;
-- Update RLS policies to use permissions

-- Profiles
CREATE POLICY "Admins with view_users permission can view all profiles"
  ON profiles FOR SELECT
  USING (has_permission('view_users'));
-- Messages
CREATE POLICY "Admins with view_chats permission can view all messages"
  ON messages FOR SELECT
  USING (has_permission('view_chats'));
-- Responses
CREATE POLICY "Admins with view_responses permission can view all responses"
  ON responses FOR SELECT
  USING (has_permission('view_responses'));
-- Matches
CREATE POLICY "Admins with view_matches permission can view all matches"
  ON matches FOR SELECT
  USING (has_permission('view_matches'));
-- Audit Logs
CREATE POLICY "Admins with view_audit_logs permission can view audit logs"
  ON audit_logs FOR SELECT
  USING (has_permission('view_audit_logs'));
