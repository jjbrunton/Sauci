-- Sauci v1.0 Initial Schema
-- Consolidated migration for production release

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================
CREATE TYPE answer_type AS ENUM ('yes', 'no', 'maybe');
CREATE TYPE match_type AS ENUM ('yes_yes', 'yes_maybe', 'maybe_maybe');
CREATE TYPE feedback_type AS ENUM ('bug', 'feature_request', 'general', 'question');
CREATE TYPE feedback_status AS ENUM ('new', 'reviewed', 'in_progress', 'resolved', 'closed');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'billing_issue', 'paused');
CREATE TYPE admin_role AS ENUM ('pack_creator', 'super_admin');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
-- ============================================================================
-- TABLES
-- ============================================================================

-- Couples table
CREATE TABLE couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  push_token TEXT,
  is_premium BOOLEAN DEFAULT false,
  couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  email TEXT,
  gender TEXT,
  show_explicit_content BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  usage_reason TEXT,
  CONSTRAINT valid_gender CHECK (gender IS NULL OR gender = ANY(ARRAY['male', 'female', 'non-binary', 'prefer-not-to-say']))
);
-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Question packs table
CREATE TABLE question_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_premium BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  category_id UUID REFERENCES categories(id),
  is_explicit BOOLEAN NOT NULL DEFAULT false
);
-- Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES question_packs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  intensity INTEGER DEFAULT 1 CHECK (intensity >= 1 AND intensity <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  partner_text TEXT,
  allowed_couple_genders TEXT[],
  target_user_genders TEXT[]
);
COMMENT ON COLUMN questions.allowed_couple_genders IS 'Array of allowed couple gender pairings (e.g., ["female+male", "female+female"]). Null means all couple types allowed.';
COMMENT ON COLUMN questions.target_user_genders IS 'Array of genders that can see this question first (as initiator). NULL = all genders. Partners still see it via partner_text after their partner answers.';
-- Responses table
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  answer answer_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);
-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  match_type match_type NOT NULL,
  is_new BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(couple_id, question_id)
);
-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  media_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  media_viewed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  CONSTRAINT content_or_media CHECK (content IS NOT NULL OR media_path IS NOT NULL)
);
-- Couple packs table (which packs a couple has enabled)
CREATE TABLE couple_packs (
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES question_packs(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (couple_id, pack_id)
);
-- Feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type feedback_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  status feedback_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL
);
-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revenuecat_app_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  entitlement_ids TEXT[] DEFAULT '{}',
  purchased_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  original_transaction_id TEXT,
  store TEXT DEFAULT 'APP_STORE',
  is_sandbox BOOLEAN DEFAULT false,
  cancel_reason TEXT,
  grace_period_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, original_transaction_id)
);
-- RevenueCat webhook events table (for idempotency)
CREATE TABLE revenuecat_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  payload JSONB
);
-- Admin users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role admin_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action audit_action NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  admin_role admin_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_couple_id ON profiles(couple_id);
CREATE INDEX idx_questions_pack_id ON questions(pack_id);
CREATE INDEX idx_question_packs_category_id ON question_packs(category_id);
CREATE INDEX idx_responses_couple_question ON responses(couple_id, question_id);
CREATE INDEX idx_matches_couple_id ON matches(couple_id);
CREATE INDEX idx_matches_is_new ON matches(is_new) WHERE is_new = true;
CREATE INDEX idx_messages_delivered_at ON messages(delivered_at) WHERE delivered_at IS NULL;
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_question_id ON feedback(question_id) WHERE question_id IS NOT NULL;
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX idx_webhook_events_event_id ON revenuecat_webhook_events(event_id);
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get authenticated user's couple_id (cached for RLS performance)
CREATE OR REPLACE FUNCTION get_auth_user_couple_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT couple_id FROM public.profiles WHERE id = auth.uid();
$$;
-- Check if user is any admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = check_user_id
    );
END;
$$;
-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = check_user_id AND role = 'super_admin'
    );
END;
$$;
-- Get admin role for user
CREATE OR REPLACE FUNCTION get_admin_role(check_user_id UUID DEFAULT auth.uid())
RETURNS admin_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    user_role public.admin_role;
BEGIN
    SELECT role INTO user_role FROM public.admin_users WHERE user_id = check_user_id;
    RETURN user_role;
END;
$$;
-- Check if user or partner has premium access
CREATE OR REPLACE FUNCTION has_premium_access(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_premium BOOLEAN;
  partner_premium BOOLEAN;
  user_couple_id UUID;
BEGIN
  SELECT is_premium, couple_id INTO user_premium, user_couple_id
  FROM public.profiles
  WHERE id = check_user_id;

  IF user_premium = TRUE THEN
    RETURN TRUE;
  END IF;

  IF user_couple_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT is_premium INTO partner_premium
  FROM public.profiles
  WHERE couple_id = user_couple_id
  AND id != check_user_id
  LIMIT 1;

  RETURN COALESCE(partner_premium, FALSE);
END;
$$;
-- Get recommended questions for a user
CREATE OR REPLACE FUNCTION get_recommended_questions(target_pack_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  text TEXT,
  partner_text TEXT,
  is_two_part BOOLEAN,
  pack_id UUID,
  intensity INTEGER,
  partner_answered BOOLEAN,
  allowed_couple_genders TEXT[],
  target_user_genders TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_couple_id UUID;
  v_user_gender TEXT;
  v_partner_gender TEXT;
  v_couple_type TEXT;
  v_has_premium BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT p.couple_id, p.gender INTO v_couple_id, v_user_gender
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.gender INTO v_partner_gender
  FROM public.profiles p
  WHERE p.couple_id = v_couple_id AND p.id != v_user_id
  LIMIT 1;

  IF v_user_gender IS NOT NULL AND v_partner_gender IS NOT NULL THEN
      IF v_user_gender < v_partner_gender THEN
        v_couple_type := v_user_gender || '+' || v_partner_gender;
      ELSE
        v_couple_type := v_partner_gender || '+' || v_user_gender;
      END IF;
  END IF;

  v_has_premium := public.has_premium_access(v_user_id);

  RETURN QUERY
  WITH user_config_exists AS (
    SELECT 1 FROM public.couple_packs WHERE couple_id = v_couple_id LIMIT 1
  ),
  active_packs AS (
    SELECT target_pack_id AS pack_id
    WHERE target_pack_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.question_packs qp
      WHERE qp.id = target_pack_id
      AND (qp.is_premium = FALSE OR v_has_premium = TRUE)
    )
    UNION ALL
    SELECT cp.pack_id FROM public.couple_packs cp
    INNER JOIN public.question_packs qp ON qp.id = cp.pack_id
    WHERE target_pack_id IS NULL
    AND cp.couple_id = v_couple_id
    AND cp.enabled = TRUE
    AND (qp.is_premium = FALSE OR v_has_premium = TRUE)
    AND EXISTS (SELECT 1 FROM user_config_exists)
    UNION ALL
    SELECT p.id AS pack_id FROM public.question_packs p
    WHERE target_pack_id IS NULL
    AND p.is_public = TRUE
    AND (p.is_premium = FALSE OR v_has_premium = TRUE)
    AND NOT EXISTS (SELECT 1 FROM user_config_exists)
  )
  SELECT
    q.id,
    CASE
      WHEN q.partner_text IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.responses r
        WHERE r.question_id = q.id
        AND r.couple_id = v_couple_id
        AND r.user_id != v_user_id
      ) THEN q.partner_text
      ELSE q.text
    END as text,
    q.partner_text,
    q.partner_text IS NOT NULL as is_two_part,
    q.pack_id,
    q.intensity,
    EXISTS (
      SELECT 1 FROM public.responses r
      WHERE r.question_id = q.id
      AND r.couple_id = v_couple_id
      AND r.user_id != v_user_id
    ) AS partner_answered,
    q.allowed_couple_genders,
    q.target_user_genders
  FROM public.questions q
  WHERE q.pack_id IN (SELECT ap.pack_id FROM active_packs ap)
  AND NOT EXISTS (
    SELECT 1 FROM public.responses r
    WHERE r.question_id = q.id
    AND r.user_id = v_user_id
  )
  AND (
    q.allowed_couple_genders IS NULL
    OR v_couple_type IS NULL
    OR v_couple_type = ANY(q.allowed_couple_genders)
  )
  AND (
    q.target_user_genders IS NULL
    OR v_user_gender = ANY(q.target_user_genders)
    OR EXISTS (
      SELECT 1 FROM public.responses r
      WHERE r.question_id = q.id
      AND r.couple_id = v_couple_id
      AND r.user_id != v_user_id
    )
  );
END;
$$;
-- Get pack teaser questions (bypasses premium for preview)
CREATE OR REPLACE FUNCTION get_pack_teaser_questions(target_pack_id UUID)
RETURNS TABLE(id UUID, text TEXT, intensity INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.text,
    q.intensity
  FROM public.questions q
  INNER JOIN public.question_packs qp ON qp.id = q.pack_id
  WHERE q.pack_id = target_pack_id
  AND qp.is_public = TRUE
  ORDER BY q.intensity ASC, random()
  LIMIT 3;
END;
$$;
-- Handle new user signup (create profile)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
-- Check couple size (max 2 members)
CREATE OR REPLACE FUNCTION check_couple_size()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.couple_id IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM profiles WHERE couple_id = NEW.couple_id AND id != NEW.id) >= 2 THEN
      RAISE EXCEPTION 'A couple can only have 2 members';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- Sync premium status from subscriptions
CREATE OR REPLACE FUNCTION sync_premium_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET is_premium = EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = NEW.user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  )
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;
-- Disable premium packs when subscription is lost
CREATE OR REPLACE FUNCTION disable_premium_packs_on_subscription_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.is_premium = TRUE AND NEW.is_premium = FALSE AND NEW.couple_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE couple_id = NEW.couple_id
        AND id != NEW.id
        AND is_premium = TRUE
    ) THEN
      UPDATE public.couple_packs cp
      SET enabled = FALSE
      FROM public.question_packs qp
      WHERE cp.pack_id = qp.id
        AND qp.is_premium = TRUE
        AND cp.couple_id = NEW.couple_id
        AND cp.enabled = TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- Log admin actions
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
    changed_fields_arr TEXT[];
BEGIN
    SELECT role INTO admin_role_val FROM public.admin_users WHERE user_id = auth.uid();

    IF admin_role_val IS NULL THEN
        RAISE EXCEPTION 'User is not an admin';
    END IF;

    IF p_action = 'UPDATE' AND p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
        SELECT ARRAY(
            SELECT key FROM jsonb_each(p_new_values)
            WHERE p_old_values->key IS DISTINCT FROM p_new_values->key
        ) INTO changed_fields_arr;
    END IF;

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
$$;
-- Notify on new message (calls edge function)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://npmmakhjmbzlkcmfyegw.supabase.co/functions/v1/send-message-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'match_id', NEW.match_id,
            'sender_id', NEW.user_id
        )
    );

    RETURN NEW;
END;
$$;
-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Profile triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER enforce_couple_size
  BEFORE INSERT OR UPDATE OF couple_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_couple_size();
CREATE TRIGGER disable_premium_packs_on_sub_loss
  AFTER UPDATE OF is_premium ON profiles
  FOR EACH ROW
  WHEN (OLD.is_premium IS DISTINCT FROM NEW.is_premium)
  EXECUTE FUNCTION disable_premium_packs_on_subscription_loss();
-- Subscription triggers
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sync_premium_on_subscription_change
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_premium_status();
-- Admin users trigger
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Message notification trigger
CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
-- Auth trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- ============================================================================
-- RLS POLICIES: COUPLES
-- ============================================================================
CREATE POLICY "Authenticated users can create couples"
  ON couples FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can view own couple"
  ON couples FOR SELECT
  USING (id = get_auth_user_couple_id());
CREATE POLICY "Users can lookup couple by exact invite code"
  ON couples FOR SELECT
  USING (id = get_auth_user_couple_id());
CREATE POLICY "Super admins can view all couples"
  ON couples FOR SELECT
  USING (is_super_admin());
-- ============================================================================
-- RLS POLICIES: PROFILES
-- ============================================================================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "Users can view partner profile"
  ON profiles FOR SELECT
  USING (couple_id IS NOT NULL AND couple_id = get_auth_user_couple_id());
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_super_admin());
CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_super_admin());
-- ============================================================================
-- RLS POLICIES: CATEGORIES
-- ============================================================================
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  USING (true);
CREATE POLICY "Admins can view all categories"
  ON categories FOR SELECT
  USING (is_admin());
CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT
  WITH CHECK (is_admin());
CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  USING (is_admin());
-- ============================================================================
-- RLS POLICIES: QUESTION PACKS
-- ============================================================================
CREATE POLICY "Anyone can view public packs"
  ON question_packs FOR SELECT
  USING (is_public = true);
CREATE POLICY "Premium users can view premium packs"
  ON question_packs FOR SELECT
  USING (is_premium = false OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_premium = true
  ));
CREATE POLICY "Admins can view all question packs"
  ON question_packs FOR SELECT
  USING (is_admin());
CREATE POLICY "Admins can insert question packs"
  ON question_packs FOR INSERT
  WITH CHECK (is_admin());
CREATE POLICY "Admins can update question packs"
  ON question_packs FOR UPDATE
  USING (is_admin());
CREATE POLICY "Admins can delete question packs"
  ON question_packs FOR DELETE
  USING (is_admin());
-- ============================================================================
-- RLS POLICIES: QUESTIONS
-- ============================================================================
CREATE POLICY "Anyone can view questions in visible packs"
  ON questions FOR SELECT
  USING (pack_id IN (
    SELECT id FROM question_packs
    WHERE is_public = true OR (is_premium = true AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_premium = true
    ))
  ));
CREATE POLICY "Admins can view all questions"
  ON questions FOR SELECT
  USING (is_admin());
CREATE POLICY "Admins can insert questions"
  ON questions FOR INSERT
  WITH CHECK (is_admin());
CREATE POLICY "Admins can update questions"
  ON questions FOR UPDATE
  USING (is_admin());
CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE
  USING (is_admin());
-- ============================================================================
-- RLS POLICIES: RESPONSES
-- ============================================================================
CREATE POLICY "Users can view couple responses"
  ON responses FOR SELECT
  USING (user_id = auth.uid() OR couple_id IN (
    SELECT couple_id FROM profiles WHERE id = auth.uid()
  ));
CREATE POLICY "Users can insert own responses"
  ON responses FOR INSERT
  WITH CHECK (user_id = auth.uid() AND couple_id = get_auth_user_couple_id());
CREATE POLICY "Users can update own responses"
  ON responses FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "Users can delete own responses"
  ON responses FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY "Super admins can view all responses"
  ON responses FOR SELECT
  USING (is_super_admin());
-- ============================================================================
-- RLS POLICIES: MATCHES
-- ============================================================================
CREATE POLICY "Users can view couple matches"
  ON matches FOR SELECT
  USING (couple_id = get_auth_user_couple_id());
CREATE POLICY "Users can update match seen status"
  ON matches FOR UPDATE
  USING (couple_id = get_auth_user_couple_id());
CREATE POLICY "Users can delete own couple matches"
  ON matches FOR DELETE
  USING (couple_id = get_auth_user_couple_id());
CREATE POLICY "Super admins can view all matches"
  ON matches FOR SELECT
  USING (is_super_admin());
-- ============================================================================
-- RLS POLICIES: MESSAGES
-- ============================================================================
CREATE POLICY "Users can view messages in their matches"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = messages.match_id
    AND m.couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
  ));
CREATE POLICY "Users can insert messages in their matches"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = messages.match_id
    AND m.couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
  ));
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  USING (auth.uid() <> user_id AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = messages.match_id
    AND m.couple_id IN (SELECT couple_id FROM profiles WHERE id = auth.uid())
  ))
  WITH CHECK (auth.uid() <> user_id);
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY "Super admins can view all messages"
  ON messages FOR SELECT
  USING (is_super_admin());
-- ============================================================================
-- RLS POLICIES: COUPLE PACKS
-- ============================================================================
CREATE POLICY "Couples can view their own pack settings"
  ON couple_packs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.couple_id = couple_packs.couple_id
  ));
CREATE POLICY "Couples can modify their own pack settings"
  ON couple_packs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.couple_id = couple_packs.couple_id
  ));
CREATE POLICY "Users can delete own couple pack settings"
  ON couple_packs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.couple_id = couple_packs.couple_id
  ));
-- ============================================================================
-- RLS POLICIES: FEEDBACK
-- ============================================================================
CREATE POLICY "Users can create feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own pending feedback"
  ON feedback FOR UPDATE
  USING (auth.uid() = user_id AND status = 'new');
CREATE POLICY "Super admins can view all feedback"
  ON feedback FOR SELECT
  USING (is_super_admin());
CREATE POLICY "Super admins can update all feedback"
  ON feedback FOR UPDATE
  USING (is_super_admin());
-- ============================================================================
-- RLS POLICIES: SUBSCRIPTIONS
-- ============================================================================
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all subscriptions"
  ON subscriptions FOR SELECT
  USING (is_super_admin());
CREATE POLICY "Super admins can insert subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (is_super_admin());
CREATE POLICY "Super admins can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (is_super_admin());
CREATE POLICY "Super admins can delete subscriptions"
  ON subscriptions FOR DELETE
  USING (is_super_admin());
-- ============================================================================
-- RLS POLICIES: REVENUECAT WEBHOOK EVENTS
-- ============================================================================
-- Service role only - no public policies needed
-- Edge functions use service role key

-- ============================================================================
-- RLS POLICIES: ADMIN USERS
-- ============================================================================
CREATE POLICY "Admin users can read own record"
  ON admin_users FOR SELECT
  USING (auth.uid() = user_id);
-- ============================================================================
-- RLS POLICIES: AUDIT LOGS
-- ============================================================================
CREATE POLICY "Super admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_super_admin());
-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE couple_packs;
-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;
-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Feedback screenshots policies
CREATE POLICY "Users can upload feedback screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can view own feedback screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- Chat media policies
-- IMPORTANT: Use storage.objects.name (not just "name") to avoid ambiguity with profiles.name
CREATE POLICY "Users can view chat media in their matches"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN profiles p ON p.couple_id = m.couple_id
      WHERE (storage.foldername(storage.objects.name))[1] = m.id::text
      AND p.id = auth.uid()
    )
  );
CREATE POLICY "Users can upload chat media to their matches"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN profiles p ON p.couple_id = m.couple_id
      WHERE (storage.foldername(storage.objects.name))[1] = m.id::text
      AND p.id = auth.uid()
    )
  );
CREATE POLICY "Users can delete their own chat media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN profiles p ON p.couple_id = m.couple_id
      WHERE (storage.foldername(storage.objects.name))[1] = m.id::text
      AND p.id = auth.uid()
    )
  );
CREATE POLICY "Admins can view all chat media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
