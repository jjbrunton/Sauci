-- Audit Logging System
-- Creates audit_logs table and RPC function for logging admin actions

-- Create action type enum for audit logging
CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- Audit log table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action public.audit_action NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    admin_role public.admin_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying audit logs
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_admin_user_id ON public.audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS (super_admins only can view logs)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_super_admin());

-- Function to log admin actions (called from frontend via RPC)
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_table_name TEXT,
    p_record_id UUID,
    p_action public.audit_action,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
    admin_role_val public.admin_role;
    changed_fields_arr TEXT[];
BEGIN
    -- Get admin role
    SELECT role INTO admin_role_val FROM public.admin_users WHERE user_id = auth.uid();

    IF admin_role_val IS NULL THEN
        RAISE EXCEPTION 'User is not an admin';
    END IF;

    -- Calculate changed fields for updates
    IF p_action = 'UPDATE' AND p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
        SELECT ARRAY(
            SELECT key FROM jsonb_each(p_new_values)
            WHERE p_old_values->key IS DISTINCT FROM p_new_values->key
        ) INTO changed_fields_arr;
    END IF;

    -- Insert audit log
    INSERT INTO public.audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_fields, admin_user_id, admin_role
    )
    VALUES (
        p_table_name, p_record_id, p_action, p_old_values, p_new_values,
        changed_fields_arr, auth.uid(), admin_role_val
    )
    RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on logging function
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;
