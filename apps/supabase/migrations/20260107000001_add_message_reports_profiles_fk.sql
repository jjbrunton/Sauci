-- Add foreign key from message_reports.reporter_id to profiles.id
-- This allows Supabase to join with profiles table in admin queries
ALTER TABLE message_reports
ADD CONSTRAINT message_reports_reporter_profile_fk
FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
