-- Admin Role-Based Access Control
-- Creates admin_users table and helper functions for role management

-- Create admin role enum
CREATE TYPE public.admin_role AS ENUM ('pack_creator', 'super_admin');

-- Admin users table (tracks which auth.users are admins and their role)
CREATE TABLE public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.admin_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX idx_admin_users_role ON public.admin_users(role);

-- Updated_at trigger
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins to read their own record
CREATE POLICY "Admin users can read own record"
    ON public.admin_users FOR SELECT
    USING (auth.uid() = user_id);

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to get admin role
CREATE OR REPLACE FUNCTION public.get_admin_role(check_user_id UUID DEFAULT auth.uid())
RETURNS public.admin_role AS $$
DECLARE
    user_role public.admin_role;
BEGIN
    SELECT role INTO user_role FROM public.admin_users WHERE user_id = check_user_id;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = check_user_id AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
