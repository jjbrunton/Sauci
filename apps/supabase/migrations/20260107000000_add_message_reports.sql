-- Create enum for report reasons
CREATE TYPE report_reason AS ENUM ('harassment', 'spam', 'inappropriate_content', 'other');
-- Create message_reports table
CREATE TABLE message_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason report_reason NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicate reports from same user
    UNIQUE(message_id, reporter_id)
);
-- Indexes for efficient queries
CREATE INDEX idx_message_reports_status ON message_reports(status);
CREATE INDEX idx_message_reports_created ON message_reports(created_at DESC);
CREATE INDEX idx_message_reports_message ON message_reports(message_id);
-- Enable RLS
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;
-- RLS Policies

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
    ON message_reports FOR SELECT
    USING (reporter_id = auth.uid());
-- Users can create reports for messages in their couple's matches (but NOT their own messages)
CREATE POLICY "Users can report partner messages"
    ON message_reports FOR INSERT
    WITH CHECK (
        reporter_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM messages m
            JOIN matches ma ON ma.id = m.match_id
            JOIN profiles p ON p.couple_id = ma.couple_id
            WHERE m.id = message_reports.message_id
            AND p.id = auth.uid()
            AND m.user_id != auth.uid()  -- Cannot report own messages
        )
    );
-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
    ON message_reports FOR SELECT
    USING (is_admin());
-- Admins can update reports (for review status)
CREATE POLICY "Admins can update reports"
    ON message_reports FOR UPDATE
    USING (is_admin());
-- Add to realtime for live updates in admin
ALTER PUBLICATION supabase_realtime ADD TABLE message_reports;
-- Comments
COMMENT ON TABLE message_reports IS 'User-submitted reports for messages. Separate from AI moderation (moderation_status on messages table).';
COMMENT ON COLUMN message_reports.status IS 'Report status: pending (new), reviewed (action taken), dismissed (no action needed).';
COMMENT ON COLUMN message_reports.reason IS 'User-selected reason for reporting: harassment, spam, inappropriate_content, or other.';
