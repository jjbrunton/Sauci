
-- Create a function that admins with gift_premium permission can use to gift premium
-- This bypasses RLS issues by using SECURITY DEFINER and checking permissions internally
CREATE OR REPLACE FUNCTION admin_gift_premium(
    target_user_id UUID,
    expires_at_param TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription_id UUID;
    v_caller_role admin_role;
    v_caller_permissions JSONB;
BEGIN
    -- Check if caller has permission
    SELECT role, permissions INTO v_caller_role, v_caller_permissions
    FROM admin_users
    WHERE user_id = auth.uid();
    
    -- Must be super_admin OR have gift_premium permission
    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Access denied: not an admin user';
    END IF;
    
    IF v_caller_role != 'super_admin' AND NOT (v_caller_permissions @> '["gift_premium"]'::jsonb) THEN
        RAISE EXCEPTION 'Access denied: missing gift_premium permission';
    END IF;
    
    -- Insert the subscription
    INSERT INTO subscriptions (
        user_id,
        revenuecat_app_user_id,
        product_id,
        status,
        store,
        purchased_at,
        expires_at
    ) VALUES (
        target_user_id,
        'admin_grant',
        'admin_premium',
        'active',
        'manual',
        NOW(),
        expires_at_param
    )
    RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
END;
$$;

-- Grant execute permission to authenticated users (the function checks permissions internally)
GRANT EXECUTE ON FUNCTION admin_gift_premium(UUID, TIMESTAMPTZ) TO authenticated;
;
