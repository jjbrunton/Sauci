-- Add deleted_at column to messages table for "delete for everyone"
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ;
-- Create message_deletions table for "delete for self" (per-user deletions)
CREATE TABLE message_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);
-- Index for efficient lookup when filtering messages
CREATE INDEX idx_message_deletions_user_message ON message_deletions(user_id, message_id);
CREATE INDEX idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NOT NULL;
-- Enable RLS on message_deletions
ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;
-- RLS Policies for message_deletions

-- Users can view their own deletions (needed for filtering)
CREATE POLICY "Users can view own deletions"
  ON message_deletions FOR SELECT
  USING (user_id = auth.uid());
-- Users can insert their own deletions (for messages in their matches)
CREATE POLICY "Users can delete messages for self"
  ON message_deletions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM messages m
      JOIN matches ma ON ma.id = m.match_id
      JOIN profiles p ON p.couple_id = ma.couple_id
      WHERE m.id = message_deletions.message_id
      AND p.id = auth.uid()
    )
  );
-- Update messages RLS policy to allow authors to set deleted_at
CREATE POLICY "Authors can soft delete messages for everyone"
  ON messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Add to realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE message_deletions;
-- Comments for documentation
COMMENT ON COLUMN messages.deleted_at IS 'Timestamp when message was deleted for everyone (author-only action). Shows "Message deleted" to all users.';
COMMENT ON TABLE message_deletions IS 'Per-user message deletions for "delete for self" functionality. Message still visible to other user.';
