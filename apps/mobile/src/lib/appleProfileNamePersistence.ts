import type { Profile } from '../types';

export interface AppleProfileNameSession {
    userId: string;
    accessToken: string;
}

export interface AppleProfileNamePersistenceDependencies {
    getProfile: (accessToken: string) => Promise<{ profile: Pick<Profile, 'id' | 'name'> }>;
    updateProfileName: (accessToken: string, name: string) => Promise<unknown>;
}

export type AppleProfileNamePersistenceResult = 'updated' | 'existing';

/**
 * Persist a first-authorization Apple display name only for the exact subject
 * and bearer that completed the authorization. The profile read protects an
 * existing Sauci nickname from being overwritten.
 */
export async function persistAppleProfileName(
    session: AppleProfileNameSession,
    name: string,
    dependencies: AppleProfileNamePersistenceDependencies,
): Promise<AppleProfileNamePersistenceResult> {
    const { profile } = await dependencies.getProfile(session.accessToken);
    if (profile.id !== session.userId) {
        throw new Error('Apple profile subject did not match the authenticated user');
    }

    if (profile.name?.trim()) {
        return 'existing';
    }

    await dependencies.updateProfileName(session.accessToken, name);
    return 'updated';
}
