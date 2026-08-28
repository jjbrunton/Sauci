ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS usage_reason text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  matches_enabled boolean NOT NULL DEFAULT true,
  messages_enabled boolean NOT NULL DEFAULT true,
  partner_activity_enabled boolean NOT NULL DEFAULT true,
  nudges_enabled boolean NOT NULL DEFAULT true,
  pack_changes_enabled boolean NOT NULL DEFAULT true,
  new_packs_enabled boolean NOT NULL DEFAULT true,
  streak_milestones_enabled boolean NOT NULL DEFAULT true,
  weekly_summary_enabled boolean NOT NULL DEFAULT true,
  unpaired_reminders_enabled boolean NOT NULL DEFAULT true,
  catchup_reminders_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bug', 'feature_request', 'general', 'question')),
  title text NOT NULL,
  description text NOT NULL,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  question_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);

