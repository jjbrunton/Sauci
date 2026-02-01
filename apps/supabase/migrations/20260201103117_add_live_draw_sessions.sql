-- Live Draw Sessions: persists canvas state for async collaborative drawing
-- One session per couple - partners draw on a shared canvas throughout the day
CREATE TABLE IF NOT EXISTS live_draw_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  strokes JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(couple_id)
);

-- Enable RLS
ALTER TABLE live_draw_sessions ENABLE ROW LEVEL SECURITY;

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE live_draw_sessions;

-- RLS: Only couple members can read their drawing
CREATE POLICY "Users can view own couple drawings"
  ON live_draw_sessions FOR SELECT
  USING (couple_id = get_auth_user_couple_id());

-- RLS: Only couple members can insert/update/delete their drawing
CREATE POLICY "Users can manage own couple drawings"
  ON live_draw_sessions FOR ALL
  USING (couple_id = get_auth_user_couple_id());

CREATE INDEX IF NOT EXISTS idx_live_draw_sessions_couple_id ON live_draw_sessions(couple_id);
