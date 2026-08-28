import { profileSettingsApi } from '../../lib/profileSettingsApi';
import { useAuthStore } from '../../store/authStore';
import { useNotificationPreferencesStore } from '../../store/notificationPreferencesStore';

jest.mock('../../lib/profileSettingsApi', () => ({
    profileSettingsApi: {
        getNotificationPreferences: jest.fn(),
        updateNotificationPreference: jest.fn(),
    },
}));

const preferences = {
    user_id: 'user-1',
    matches_enabled: true,
    messages_enabled: true,
    partner_activity_enabled: true,
    nudges_enabled: true,
    pack_changes_enabled: true,
    new_packs_enabled: true,
    streak_milestones_enabled: true,
    weekly_summary_enabled: true,
    unpaired_reminders_enabled: true,
    catchup_reminders_enabled: true,
    streak_reminders_enabled: true,
    created_at: '2026-08-27T10:00:00.000Z',
    updated_at: '2026-08-27T10:00:00.000Z',
};

describe('notificationPreferencesStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ user: { id: 'user-1' } } as any);
        useNotificationPreferencesStore.getState().clearPreferences();
    });

    it('loads server defaults and persists an authenticated preference update', async () => {
        (profileSettingsApi.getNotificationPreferences as jest.Mock).mockResolvedValue(preferences);
        (profileSettingsApi.updateNotificationPreference as jest.Mock)
            .mockResolvedValue({ ...preferences, messages_enabled: false });

        await useNotificationPreferencesStore.getState().fetchPreferences();
        await useNotificationPreferencesStore.getState().updatePreference('messages_enabled', false);

        expect(profileSettingsApi.getNotificationPreferences).toHaveBeenCalledWith();
        expect(profileSettingsApi.updateNotificationPreference).toHaveBeenCalledWith('messages_enabled', false);
        expect(useNotificationPreferencesStore.getState().preferences?.messages_enabled).toBe(false);
    });
});
