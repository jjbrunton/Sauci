-- Security Hardening Migration
-- Fixes: Weak invite codes, overly permissive RLS, password settings

-- ============================================
-- 1. Strengthen invite code generation
-- Use crypto-secure random with alphanumeric chars (8 chars retained for UX)
-- ============================================

-- Create a function to generate secure invite codes
CREATE OR REPLACE FUNCTION generate_secure_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars: I, O, 0, 1
    result TEXT := '';
    i INTEGER;
    rand_bytes BYTEA;
BEGIN
    -- Get 8 cryptographically secure random bytes
    rand_bytes := gen_random_bytes(8);
    
    FOR i IN 1..8 LOOP
        result := result || substr(chars, (get_byte(rand_bytes, i-1) % 32) + 1, 1);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the default for new couples to use secure generation
ALTER TABLE public.couples 
ALTER COLUMN invite_code SET DEFAULT generate_secure_invite_code();

-- Add rate limiting tracking table for invite code attempts
CREATE TABLE IF NOT EXISTS public.invite_code_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_hash TEXT NOT NULL, -- Hashed IP for privacy
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    was_successful BOOLEAN DEFAULT FALSE
);

-- Index for efficient rate limiting queries
CREATE INDEX IF NOT EXISTS idx_invite_attempts_user_time 
ON public.invite_code_attempts(user_id, attempted_at);

-- Enable RLS on attempts table
ALTER TABLE public.invite_code_attempts ENABLE ROW LEVEL SECURITY;

-- Only allow inserts from authenticated users
CREATE POLICY "Authenticated users can log attempts"
    ON public.invite_code_attempts
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');


-- ============================================
-- 2. Fix overly permissive couples RLS policy
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view couple by invite code" ON public.couples;

-- Replace with a more restrictive policy
-- Users can only view their own couple OR look up a couple via RPC (not direct table access)
CREATE POLICY "Users can only view their own couple"
    ON public.couples FOR SELECT
    USING (
        id IN (SELECT couple_id FROM public.profiles WHERE id = auth.uid())
    );

-- Create a secure RPC function for invite code lookup
-- This only returns success/failure, not couple data
CREATE OR REPLACE FUNCTION public.verify_invite_code(code TEXT)
RETURNS JSONB AS $$
DECLARE
    couple_record RECORD;
    member_count INTEGER;
BEGIN
    -- Normalize the code
    code := UPPER(TRIM(code));
    
    -- Check if code exists
    SELECT id INTO couple_record
    FROM public.couples
    WHERE UPPER(invite_code) = code;
    
    IF couple_record.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite code');
    END IF;
    
    -- Check member count
    SELECT COUNT(*) INTO member_count
    FROM public.profiles
    WHERE couple_id = couple_record.id;
    
    IF member_count >= 2 THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This couple already has two partners');
    END IF;
    
    RETURN jsonb_build_object('valid', true, 'couple_id', couple_record.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_invite_code(TEXT) TO authenticated;


-- ============================================
-- 3. Optional: Add password policy comment
-- (Password length is enforced client-side, but should also be in Supabase Auth config)
-- ============================================

COMMENT ON SCHEMA public IS 'Password policy: Minimum 8 characters required. Configure in Supabase Dashboard > Auth > Policies';


-- ============================================
-- 4. Protect push tokens from being accessed by other users
-- Push tokens should only be accessible via service role for notifications
-- ============================================

-- Create a secure view for partner profile access that excludes sensitive fields
CREATE OR REPLACE VIEW public.partner_profiles AS
SELECT 
    id,
    name,
    avatar_url,
    is_premium,
    couple_id,
    created_at,
    updated_at,
    show_explicit_content
    -- Explicitly excluding: push_token
FROM public.profiles;

-- Allow authenticated users to query the view
GRANT SELECT ON public.partner_profiles TO authenticated;

-- Add comment explaining the security rationale
COMMENT ON VIEW public.partner_profiles IS 
'Secure view of profiles excluding push_token. Use this view when displaying partner information. Push tokens are only accessible via service role for sending notifications.';

-- Create a function to safely get partner info without exposing push_token
CREATE OR REPLACE FUNCTION public.get_partner_profile()
RETURNS JSONB AS $$
DECLARE
    current_couple_id UUID;
    partner_data JSONB;
BEGIN
    -- Get current user's couple_id
    SELECT couple_id INTO current_couple_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    IF current_couple_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get partner profile without sensitive fields
    SELECT jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'avatar_url', p.avatar_url,
        'is_premium', p.is_premium,
        'couple_id', p.couple_id,
        'created_at', p.created_at
    ) INTO partner_data
    FROM public.profiles p
    WHERE p.couple_id = current_couple_id
    AND p.id != auth.uid();
    
    RETURN partner_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_partner_profile() TO authenticated;
