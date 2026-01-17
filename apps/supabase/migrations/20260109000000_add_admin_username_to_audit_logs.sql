-- Add admin_username column to audit_logs table
ALTER TABLE audit_logs 
ADD COLUMN admin_username TEXT;
-- Backfill existing audit logs with admin names from profiles
UPDATE audit_logs
SET admin_username = COALESCE(p.name, p.email, 'Unknown')
FROM profiles p
WHERE audit_logs.admin_user_id = p.id
  AND audit_logs.admin_username IS NULL;
-- Update the log_admin_action function to populate admin_username from profiles
CREATE OR REPLACE FUNCTION log_admin_action(
  p_table_name TEXT,
  p_record_id UUID,
  p_action audit_action,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    log_id UUID;
    admin_role_val public.admin_role;
    admin_username_val TEXT;
    changed_fields_arr TEXT[];
BEGIN
    -- Get admin role from admin_users table
    SELECT role 
    INTO admin_role_val 
    FROM public.admin_users 
    WHERE user_id = auth.uid();

    IF admin_role_val IS NULL THEN
        RAISE EXCEPTION 'User is not an admin';
    END IF;

    -- Get username from profiles table (name or email as fallback)
    SELECT COALESCE(name, email, 'Unknown')
    INTO admin_username_val
    FROM public.profiles
    WHERE id = auth.uid();

    IF p_action = 'UPDATE' AND p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
        SELECT ARRAY(
            SELECT key FROM jsonb_each(p_new_values)
            WHERE p_old_values->key IS DISTINCT FROM p_new_values->key
        ) INTO changed_fields_arr;
    END IF;

    INSERT INTO public.audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_fields, admin_user_id, admin_role, admin_username
    )
    VALUES (
        p_table_name, p_record_id, p_action, p_old_values, p_new_values,
        changed_fields_arr, auth.uid(), admin_role_val, admin_username_val
    )
    RETURNING id INTO log_id;

    RETURN log_id;
END;
$$;
