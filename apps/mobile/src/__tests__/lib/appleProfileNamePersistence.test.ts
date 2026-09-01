import { persistAppleProfileName } from '@/lib/appleProfileNamePersistence';

describe('persistAppleProfileName', () => {
    const session = { userId: 'apple-user', accessToken: 'apple-token' };
    const getProfile = jest.fn();
    const updateProfileName = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('writes a supplied name only after a matching blank profile is read with the captured bearer', async () => {
        getProfile.mockResolvedValue({ profile: { id: 'apple-user', name: null } });
        updateProfileName.mockResolvedValue({ updated: true });

        await expect(persistAppleProfileName(session, 'Ada Lovelace', { getProfile, updateProfileName }))
            .resolves.toBe('updated');
        expect(getProfile).toHaveBeenCalledWith('apple-token');
        expect(updateProfileName).toHaveBeenCalledWith('apple-token', 'Ada Lovelace');
    });

    it('preserves a returning user nickname', async () => {
        getProfile.mockResolvedValue({ profile: { id: 'apple-user', name: 'Ada B' } });

        await expect(persistAppleProfileName(session, 'Ada Lovelace', { getProfile, updateProfileName }))
            .resolves.toBe('existing');
        expect(updateProfileName).not.toHaveBeenCalled();
    });

    it('fails closed on a subject mismatch before any profile write', async () => {
        getProfile.mockResolvedValue({ profile: { id: 'different-user', name: null } });

        await expect(persistAppleProfileName(session, 'Ada Lovelace', { getProfile, updateProfileName }))
            .rejects.toThrow('subject did not match');
        expect(updateProfileName).not.toHaveBeenCalled();
    });

    it('propagates API failure so the caller can clear its pending onboarding name', async () => {
        getProfile.mockRejectedValue(new Error('offline'));

        await expect(persistAppleProfileName(session, 'Ada Lovelace', { getProfile, updateProfileName }))
            .rejects.toThrow('offline');
        expect(updateProfileName).not.toHaveBeenCalled();
    });
});
