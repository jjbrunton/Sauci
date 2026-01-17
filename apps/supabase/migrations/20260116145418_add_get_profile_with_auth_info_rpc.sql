-- Create RPC function to get a single profile with auth info
CREATE OR REPLACE FUNCTION get_profile_with_auth_info(user_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    avatar_url text,
    is_premium boolean,
    couple_id uuid,
    created_at timestamptz,
    gender text,
    usage_reason text,
    show_explicit_content boolean,
    onboarding_completed boolean,
    max_intensity smallint,
    last_sign_in_at timestamptz,
    email_confirmed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.id,
        COALESCE(p.name, au.raw_user_meta_data->>'name')::text as name,
        COALESCE(p.email, au.email)::text as email,
        p.avatar_url::text,
        p.is_premium,
        p.couple_id,
        p.created_at,
        p.gender::text,
        p.usage_reason::text,
        p.show_explicit_content,
        p.onboarding_completed,
        p.max_intensity,
        au.last_sign_in_at,
        au.email_confirmed_at
    FROM profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    WHERE p.id = user_id;
$$;;
