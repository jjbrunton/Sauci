-- Redemption codes table
CREATE TABLE redemption_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Code redemptions table
CREATE TABLE code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES redemption_codes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code_id, user_id)
);
ALTER TABLE redemption_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins with manage_codes permission can view redemption codes"
  ON redemption_codes FOR SELECT
  USING (has_permission('manage_codes'::text));
CREATE POLICY "Admins with manage_codes permission can insert redemption codes"
  ON redemption_codes FOR INSERT
  WITH CHECK (has_permission('manage_codes'::text));
CREATE POLICY "Admins with manage_codes permission can update redemption codes"
  ON redemption_codes FOR UPDATE
  USING (has_permission('manage_codes'::text));
CREATE POLICY "Admins with manage_codes permission can delete redemption codes"
  ON redemption_codes FOR DELETE
  USING (has_permission('manage_codes'::text));
CREATE POLICY "Super admins can manage redemption codes"
  ON redemption_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role = 'super_admin'::admin_role
    )
  );
CREATE POLICY "Users can view own redemptions"
  ON code_redemptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all redemptions"
  ON code_redemptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role = 'super_admin'::admin_role
    )
  );
CREATE OR REPLACE FUNCTION public.redeem_code_by_email(p_email text, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_code_record record;
    v_user_record record;
    v_existing_redemption record;
BEGIN
    -- Find the user by email
    SELECT id INTO v_user_record
    FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email);
    
    IF v_user_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No account found with this email address');
    END IF;
    
    -- Find the code
    SELECT * INTO v_code_record
    FROM public.redemption_codes
    WHERE UPPER(code) = UPPER(p_code);
    
    IF v_code_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption code');
    END IF;
    
    -- Check if code is active
    IF NOT v_code_record.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'This code is no longer active');
    END IF;
    
    -- Check if code has expired
    IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'This code has expired');
    END IF;
    
    -- Check if code has uses remaining
    IF v_code_record.max_uses IS NOT NULL AND v_code_record.current_uses >= v_code_record.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'This code has reached its maximum number of uses');
    END IF;
    
    -- Check if user has already redeemed this code
    SELECT * INTO v_existing_redemption
    FROM public.code_redemptions
    WHERE code_id = v_code_record.id AND user_id = v_user_record.id;
    
    IF v_existing_redemption IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code');
    END IF;
    
    -- All checks passed - redeem the code
    -- 1. Create redemption record
    INSERT INTO public.code_redemptions (code_id, user_id)
    VALUES (v_code_record.id, v_user_record.id);
    
    -- 2. Increment current_uses
    UPDATE public.redemption_codes
    SET current_uses = current_uses + 1,
        updated_at = now()
    WHERE id = v_code_record.id;
    
    -- 3. Set user as premium
    UPDATE public.profiles
    SET is_premium = true,
        updated_at = now()
    WHERE id = v_user_record.id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Code redeemed successfully! You now have premium access.');
END;
$function$;
GRANT EXECUTE ON FUNCTION public.redeem_code_by_email(text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_code_by_email(text, text) TO anon, authenticated, service_role;
