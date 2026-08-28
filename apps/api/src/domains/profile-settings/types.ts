export const notificationPreferenceKeys = [
  'matches_enabled',
  'messages_enabled',
  'partner_activity_enabled',
  'nudges_enabled',
  'pack_changes_enabled',
  'new_packs_enabled',
  'streak_milestones_enabled',
  'weekly_summary_enabled',
  'unpaired_reminders_enabled',
  'catchup_reminders_enabled',
] as const;

export type NotificationPreferenceKey = typeof notificationPreferenceKeys[number];

export interface NotificationPreferences extends Record<NotificationPreferenceKey, boolean> {
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  name?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
  usage_reason?: 'improve_communication' | 'spice_up_intimacy' | 'deeper_connection' | 'have_fun' | 'strengthen_relationship' | null;
  max_intensity?: 1 | 2 | 3 | 4 | 5;
  show_explicit_content?: boolean;
  hide_nsfw?: boolean;
  onboarding_completed?: boolean;
  onboarding_version?: number;
  public_key_jwk?: Record<string, unknown> | null;
  push_token?: string | null;
}

export interface FeedbackSubmission {
  type: 'bug' | 'feature_request' | 'general' | 'question';
  title: string;
  description: string;
  question_id?: string | null;
  device_info?: Record<string, unknown>;
  screenshot_media_id?: string | null;
}
