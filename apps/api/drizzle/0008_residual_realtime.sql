ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_nudge_sent_at timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS live_draw_sessions (
  couple_id uuid PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision bigint NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_draw_sessions_strokes_array CHECK (jsonb_typeof(strokes) = 'array')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS live_draw_sessions_updated_at_idx
  ON live_draw_sessions(updated_at DESC);
