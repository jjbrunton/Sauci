import { apiClient } from './apiClient';
import type { Gender } from '../types';
import type { NotificationPreferences } from '../store/notificationPreferencesStore';

export interface ProfileUpdate {
    name?: string;
    gender?: Gender | null;
    usage_reason?: 'improve_communication' | 'reconnect' | 'spice_up_intimacy' | 'deeper_connection' | 'have_fun' | 'strengthen_relationship' | null;
    max_intensity?: 1 | 2 | 3 | 4 | 5;
    show_explicit_content?: boolean;
    hide_nsfw?: boolean;
    onboarding_completed?: boolean;
    onboarding_version?: number;
    public_key_jwk?: Record<string, unknown> | null;
    push_token?: string | null;
}

type PreferenceKey = keyof Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>;

export const profileSettingsApi = {
    updateProfile: (update: ProfileUpdate) => apiClient.patch<{ updated: true }>('/v1/me/profile', update),
    updateLastActive: () => apiClient.post<void>('/v1/me/activity'),
    getNotificationPreferences: () => apiClient.get<NotificationPreferences>('/v1/me/notification-preferences'),
    updateNotificationPreference: (key: PreferenceKey, value: boolean) =>
        apiClient.patch<NotificationPreferences>('/v1/me/notification-preferences', { key, value }),
    submitFeedback: (feedback: {
        type: 'bug' | 'feature_request' | 'general' | 'question';
        title: string;
        description: string;
        question_id?: string;
        device_info?: object;
        screenshot_media_id?: string;
    }) => apiClient.post<{ id: string; created_at: string }>('/v1/feedback', feedback),
};
