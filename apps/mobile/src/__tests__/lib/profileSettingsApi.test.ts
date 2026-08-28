import { apiClient } from '../../lib/apiClient';
import { profileSettingsApi } from '../../lib/profileSettingsApi';

jest.mock('../../lib/apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
    },
}));

describe('profileSettingsApi', () => {
    it('routes profile, activity, preference, and feedback operations through the standalone API', async () => {
        await profileSettingsApi.updateProfile({ name: 'Alice' });
        await profileSettingsApi.updateLastActive();
        await profileSettingsApi.getNotificationPreferences();
        await profileSettingsApi.updateNotificationPreference('messages_enabled', false);
        await profileSettingsApi.submitFeedback({ type: 'bug', title: 'Title', description: 'Details' });

        expect(apiClient.patch).toHaveBeenNthCalledWith(1, '/v1/me/profile', { name: 'Alice' });
        expect(apiClient.post).toHaveBeenNthCalledWith(1, '/v1/me/activity');
        expect(apiClient.get).toHaveBeenCalledWith('/v1/me/notification-preferences');
        expect(apiClient.patch).toHaveBeenNthCalledWith(2, '/v1/me/notification-preferences', {
            key: 'messages_enabled', value: false,
        });
        expect(apiClient.post).toHaveBeenNthCalledWith(2, '/v1/feedback', {
            type: 'bug', title: 'Title', description: 'Details',
        });
    });
});
