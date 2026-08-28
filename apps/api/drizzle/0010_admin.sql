CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('pack_creator', 'super_admin')),
  permissions text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS admin_users_active_user_idx ON admin_users(user_id) WHERE is_active = true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'ACTION')),
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_user_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS pack_topics (
  pack_id uuid NOT NULL REFERENCES question_packs(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_id, topic_id)
);
--> statement-breakpoint
ALTER TABLE categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE question_packs ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE questions ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE question_packs
  ADD COLUMN IF NOT EXISTS scheduled_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_notified boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS inverse_of uuid REFERENCES questions(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'unmoderated',
  ADD COLUMN IF NOT EXISTS flag_reason text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT messages_moderation_status_check
    CHECK (moderation_status IS NULL OR moderation_status IN ('safe', 'flagged', 'unmoderated'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE message_reports
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
--> statement-breakpoint
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS admin_notes text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openrouter_api_key text,
  default_model text DEFAULT 'openai/gpt-4o-mini',
  default_temperature double precision,
  model_generate text,
  temperature_generate double precision,
  model_fix text,
  temperature_fix double precision,
  model_polish text,
  temperature_polish double precision,
  council_enabled boolean NOT NULL DEFAULT false,
  council_generator_model text DEFAULT 'anthropic/claude-3.5-sonnet',
  council_generators jsonb DEFAULT '[{"model":"anthropic/claude-3.5-sonnet"}]'::jsonb,
  council_reviewer_model text DEFAULT 'google/gemini-pro-1.5',
  council_reviewer_temperature double precision,
  council_selection_mode text DEFAULT 'whole_set' CHECK (
    council_selection_mode IS NULL OR council_selection_mode IN ('whole_set', 'cherry_pick')
  ),
  cherry_pick_ensure_intensity_distribution boolean DEFAULT true,
  classifier_enabled boolean DEFAULT true,
  classifier_model text DEFAULT 'openai/gpt-4o',
  classifier_temperature double precision,
  classifier_prompt text,
  heuristics_enabled boolean NOT NULL DEFAULT false,
  heuristic_min_text_length integer NOT NULL DEFAULT 12,
  heuristic_whitelist_max_length integer NOT NULL DEFAULT 30,
  heuristic_skip_if_no_alnum boolean NOT NULL DEFAULT true,
  heuristic_skip_media_without_text boolean NOT NULL DEFAULT false,
  heuristic_record_reason boolean NOT NULL DEFAULT false,
  heuristic_use_default_whitelist boolean NOT NULL DEFAULT true,
  heuristic_use_default_keywords boolean NOT NULL DEFAULT true,
  heuristic_whitelist text,
  heuristic_keyword_triggers text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ai_config_singleton_idx ON ai_config ((true));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS dare_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, icon text,
  is_premium boolean NOT NULL DEFAULT false, is_public boolean NOT NULL DEFAULT true,
  is_explicit boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  min_intensity integer, max_intensity integer, avg_intensity numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS dares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES dare_packs(id) ON DELETE CASCADE,
  text text NOT NULL, intensity integer NOT NULL DEFAULT 1 CHECK (intensity BETWEEN 1 AND 5),
  suggested_duration_hours integer, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dares_pack_idx ON dares(pack_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS master_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text NOT NULL UNIQUE,
  public_key_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sent_dares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  dare_id uuid REFERENCES dares(id) ON DELETE SET NULL,
  custom_dare_text text,
  custom_dare_intensity integer CHECK (
    custom_dare_intensity IS NULL OR custom_dare_intensity BETWEEN 1 AND 5
  ),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'completed', 'expired', 'declined', 'cancelled')
  ),
  sent_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  sender_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sent_dares_dare_or_custom_check CHECK (
    dare_id IS NOT NULL OR custom_dare_text IS NOT NULL
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_dares_couple_idx ON sent_dares(couple_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_dares_dare_idx ON sent_dares(dare_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS dare_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_dare_id uuid NOT NULL REFERENCES sent_dares(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dare_messages_sent_dare_created_idx
  ON dare_messages(sent_dare_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dare_messages_sender_idx ON dare_messages(sender_id);
