-- Create match_archives table for per-user match archiving
-- Similar pattern to message_deletions table
CREATE TABLE match_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Index for efficient lookup when filtering matches
CREATE INDEX idx_match_archives_user_match ON match_archives(user_id, match_id);

-- Enable RLS on match_archives
ALTER TABLE match_archives ENABLE ROW LEVEL SECURITY;

-- RLS Policies for match_archives

-- Users can view their own archives (needed for filtering)
CREATE POLICY "Users can view own archives"
  ON match_archives FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own archives (for matches in their couples)
CREATE POLICY "Users can archive matches"
  ON match_archives FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM matches m
      JOIN profiles p ON p.couple_id = m.couple_id
      WHERE m.id = match_archives.match_id
      AND p.id = auth.uid()
    )
  );

-- Users can delete their own archives (for unarchiving)
CREATE POLICY "Users can unarchive matches"
  ON match_archives FOR DELETE
  USING (user_id = auth.uid());

-- Add to realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE match_archives;

-- Documentation
COMMENT ON TABLE match_archives IS 'Per-user match archives. Partner still sees the match. Delete record to unarchive.';
