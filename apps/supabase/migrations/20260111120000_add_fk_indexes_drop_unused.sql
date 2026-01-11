-- Add indexes for unindexed foreign keys
-- These improve JOIN and DELETE performance

CREATE INDEX IF NOT EXISTS idx_admin_users_created_by ON public.admin_users(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_config_updated_by ON public.ai_config(updated_by);
CREATE INDEX IF NOT EXISTS idx_app_config_updated_by ON public.app_config(updated_by);
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user_id ON public.code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_couple_packs_pack_id ON public.couple_packs(pack_id);
CREATE INDEX IF NOT EXISTS idx_dare_messages_sender_id ON public.dare_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_matches_question_id ON public.matches(question_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reporter_id ON public.message_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reviewed_by ON public.message_reports(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_redemption_codes_created_by ON public.redemption_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_responses_question_id ON public.responses(question_id);
CREATE INDEX IF NOT EXISTS idx_sent_dares_dare_id ON public.sent_dares(dare_id);

-- Drop unused indexes (identified by Supabase advisor as never used)
-- These are just consuming storage with no benefit

DROP INDEX IF EXISTS public.idx_feedback_type;
DROP INDEX IF EXISTS public.idx_feedback_status;
DROP INDEX IF EXISTS public.idx_subscriptions_expires_at;
DROP INDEX IF EXISTS public.idx_webhook_events_event_id;
DROP INDEX IF EXISTS public.idx_audit_logs_record_id;
DROP INDEX IF EXISTS public.idx_audit_logs_action;
DROP INDEX IF EXISTS public.idx_pack_topics_topic_id;
DROP INDEX IF EXISTS public.idx_feature_interests_feature_name;
DROP INDEX IF EXISTS public.idx_profiles_couple_id_public_key;
DROP INDEX IF EXISTS public.idx_messages_deleted_at;
DROP INDEX IF EXISTS public.idx_message_reports_created;
DROP INDEX IF EXISTS public.idx_dare_packs_visibility;
DROP INDEX IF EXISTS public.idx_dares_pack_id;
DROP INDEX IF EXISTS public.idx_dares_intensity;
DROP INDEX IF EXISTS public.idx_sent_dares_sender_id;
DROP INDEX IF EXISTS public.idx_sent_dares_recipient_id;
DROP INDEX IF EXISTS public.idx_sent_dares_status;
DROP INDEX IF EXISTS public.idx_sent_dares_expires_at;
DROP INDEX IF EXISTS public.idx_dare_messages_sent_dare_id;
DROP INDEX IF EXISTS public.idx_dare_messages_created_at;
DROP INDEX IF EXISTS public.idx_questions_deleted_at;
