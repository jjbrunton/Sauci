import { ApiError, apiClient } from "@/lib/apiClient";
import { authClient } from "@/lib/authClient";
import { coupleApi } from "@/lib/coupleApi";
import { profileSettingsApi } from "@/lib/profileSettingsApi";
import { useAuthStore } from "@/store/authStore";
import { useMatchStore } from "@/store/matchStore";
import { useMessageStore } from "@/store/messageStore";
import { usePacksStore } from "@/store/packsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import type { Profile } from "@/types";

const profile = {
    id: "me",
    name: "Test User",
    email: "test@example.com",
    avatar_url: null,
    push_token: null,
    is_premium: false,
    couple_id: null,
    gender: null,
    show_explicit_content: false,
    max_intensity: 3,
    hide_nsfw: true,
    onboarding_completed: false,
    onboarding_version: 0,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
};

describe("authStore", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (authClient.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { user: { id: "me" }, access_token: "token-me" } },
        });
        // fetchUser always fetches couple state now, since it also carries the
        // sealed answer count for a user who has no couple yet. Individual tests
        // override this when they care about the couple/partner shape.
        jest.spyOn(coupleApi, "getState").mockResolvedValue({ couple: null, partner: null, sealed_count: 0 });
        jest.spyOn(coupleApi, "getStateWithAccessToken").mockResolvedValue({ couple: null, partner: null, sealed_count: 0 });
        useAuthStore.setState({
            user: null,
            couple: null,
            partner: null,
            sealedCount: 0,
            isLoading: true,
            isAuthenticated: false,
            isAnonymous: false,
            pendingAppleDisplayName: null,
        } as any);
        useMatchStore.setState({ matches: [{ id: "m1" }], newMatchesCount: 1 } as any);
        usePacksStore.setState({ enabledPackIds: ["p1"] } as any);
        useMessageStore.setState({ unreadCount: 3, lastMessage: { id: "msg1" }, activeMatchId: "match1" } as any);
        useSubscriptionStore.setState({ subscription: { isProUser: true } } as any);
    });

    it("sets unauthenticated when no hosted auth session exists", async () => {
        (authClient.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: null } });

        await useAuthStore.getState().fetchUser();

        expect(useAuthStore.getState()).toMatchObject({
            user: null,
            isAuthenticated: false,
            isAnonymous: false,
            isLoading: false,
        });
    });

    it("bootstraps and reads the profile through GET /v1/me", async () => {
        (authClient.auth.getSession as jest.Mock).mockResolvedValueOnce({
            data: { session: { user: { id: "me", is_anonymous: true }, access_token: "token-me" } },
        });
        const getSpy = jest.spyOn(apiClient, "getWithAccessToken").mockResolvedValueOnce({ profile });

        await useAuthStore.getState().fetchUser();

        expect(getSpy).toHaveBeenCalledWith("/v1/me", "token-me");
        expect(useAuthStore.getState()).toMatchObject({
            user: profile,
            isAuthenticated: true,
            isAnonymous: true,
            isLoading: false,
        });
    });

    it("reads couple and partner state through the standalone API", async () => {
        const pairedProfile = { ...profile, couple_id: "couple-1" };
        const couple = {
            id: "couple-1",
            invite_code: "ABCD2345",
            created_at: "2026-08-27T00:00:00.000Z",
        };
        const partner: Profile = {
            ...profile,
            id: "partner",
            name: "Partner",
            couple_id: "couple-1",
            max_intensity: 3,
        };
        useAuthStore.setState({ user: pairedProfile } as any);
        const stateSpy = jest.spyOn(coupleApi, "getState").mockResolvedValueOnce({ couple, partner, sealed_count: 3 });

        await useAuthStore.getState().fetchCouple();

        expect(stateSpy).toHaveBeenCalledWith();
        expect(useAuthStore.getState()).toMatchObject({ couple, partner, sealedCount: 3 });
    });

    it("updates activity through the standalone API", async () => {
        useAuthStore.setState({ user: profile } as any);
        const activitySpy = jest.spyOn(profileSettingsApi, "updateLastActive").mockResolvedValueOnce();

        await useAuthStore.getState().updateLastActive();

        expect(activitySpy).toHaveBeenCalledWith();
    });

    it("clears user-scoped stores and hosted auth when the API rejects the session", async () => {
        useAuthStore.setState({ sealedCount: 3 } as any);
        (authClient.auth.getSession as jest.Mock).mockResolvedValueOnce({
            data: { session: { user: { id: "me" }, access_token: "token-me" } },
        });
        jest.spyOn(apiClient, "getWithAccessToken").mockRejectedValueOnce(new ApiError("Unauthorized", 401));
        (authClient.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

        await useAuthStore.getState().fetchUser();

        expect(useAuthStore.getState()).toMatchObject({
            user: null,
            sealedCount: 0,
            isAuthenticated: false,
            isAnonymous: false,
            isLoading: false,
        });
        expect(useMatchStore.getState().matches).toEqual([]);
        expect(usePacksStore.getState().enabledPackIds).toEqual([]);
        expect(useMessageStore.getState().unreadCount).toBe(0);
        expect(useSubscriptionStore.getState().subscription).toMatchObject({ isProUser: false });
        expect(authClient.auth.signOut).toHaveBeenCalled();
    });

    it("does not let an older session response overwrite a newer profile", async () => {
        let currentSession = { user: { id: "user-a" }, access_token: "token-a" };
        (authClient.auth.getSession as jest.Mock).mockImplementation(async () => ({ data: { session: currentSession } }));

        let resolveA!: (value: { profile: Profile }) => void;
        let resolveB!: (value: { profile: Profile }) => void;
        const getSpy = jest.spyOn(apiClient, "getWithAccessToken")
            .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));

        const firstFetch = useAuthStore.getState().fetchUser();
        currentSession = { user: { id: "user-b" }, access_token: "token-b" };
        const secondFetch = useAuthStore.getState().fetchUser();
        await Promise.resolve();
        await Promise.resolve();

        resolveB({ profile: { ...profile, id: "user-b", name: "Newer Name" } as Profile });
        await secondFetch;
        resolveA({ profile: { ...profile, id: "user-a", name: "Older Name" } as Profile });
        await firstFetch;

        expect(getSpy).toHaveBeenNthCalledWith(1, "/v1/me", "token-a");
        expect(getSpy).toHaveBeenNthCalledWith(2, "/v1/me", "token-b");
        expect(useAuthStore.getState()).toMatchObject({
            user: expect.objectContaining({ id: "user-b", name: "Newer Name" }),
            isAuthenticated: true,
            isLoading: false,
        });
    });

    it("does not let an older couple response overwrite a newer session", async () => {
        let currentSession = { user: { id: "user-a" }, access_token: "token-a" };
        (authClient.auth.getSession as jest.Mock).mockImplementation(async () => ({ data: { session: currentSession } }));
        jest.spyOn(apiClient, "getWithAccessToken")
            .mockResolvedValueOnce({ profile: { ...profile, id: "user-a", name: "Older Name" } })
            .mockResolvedValueOnce({ profile: { ...profile, id: "user-b", name: "Newer Name" } });

        let resolveCoupleA!: (value: { couple: null; partner: null; sealed_count: number }) => void;
        jest.spyOn(coupleApi, "getStateWithAccessToken")
            .mockImplementationOnce(() => new Promise((resolve) => { resolveCoupleA = resolve; }))
            .mockResolvedValueOnce({ couple: null, partner: null, sealed_count: 7 });

        const firstFetch = useAuthStore.getState().fetchUser();
        for (let attempt = 0; attempt < 10 && !resolveCoupleA; attempt += 1) {
            await Promise.resolve();
        }
        expect(resolveCoupleA).toBeDefined();
        currentSession = { user: { id: "user-b" }, access_token: "token-b" };
        const secondFetch = useAuthStore.getState().fetchUser();
        await secondFetch;
        resolveCoupleA({ couple: null, partner: null, sealed_count: 1 });
        await firstFetch;

        expect(useAuthStore.getState()).toMatchObject({
            user: expect.objectContaining({ id: "user-b", name: "Newer Name" }),
            sealedCount: 7,
            isLoading: false,
        });
    });

    it("rejects a mismatched API profile without signing out the active session", async () => {
        useAuthStore.setState({
            user: profile,
            couple: { id: "prior-couple", invite_code: "PRIOR123", created_at: profile.created_at },
            partner: { ...profile, id: "prior-partner", name: "Prior Partner" },
            sealedCount: 4,
            isAuthenticated: true,
            isAnonymous: true,
            pendingAppleDisplayName: { userId: "me", name: "Prior Name" },
        } as any);
        jest.spyOn(apiClient, "getWithAccessToken").mockResolvedValueOnce({
            profile: { ...profile, id: "different-user", name: "Wrong Subject" },
        });

        await useAuthStore.getState().fetchUser();

        expect(useAuthStore.getState()).toMatchObject({
            user: null,
            couple: null,
            partner: null,
            sealedCount: 0,
            isAuthenticated: false,
            isAnonymous: false,
            isLoading: false,
            pendingAppleDisplayName: null,
        });
        expect(useMatchStore.getState().matches).toEqual([]);
        expect(usePacksStore.getState().enabledPackIds).toEqual([]);
        expect(useMessageStore.getState().unreadCount).toBe(0);
        expect(useSubscriptionStore.getState().subscription).toMatchObject({ isProUser: false });
        expect(authClient.auth.signOut).not.toHaveBeenCalled();
        expect(coupleApi.getStateWithAccessToken).not.toHaveBeenCalled();
    });

    it("does not sign out a newer session when an older request is rejected", async () => {
        let currentSession = { user: { id: "user-a" }, access_token: "token-a" };
        (authClient.auth.getSession as jest.Mock).mockImplementation(async () => ({ data: { session: currentSession } }));

        let rejectA!: (error: Error) => void;
        const getSpy = jest.spyOn(apiClient, "getWithAccessToken")
            .mockImplementationOnce(() => new Promise((_, reject) => { rejectA = reject; }))
            .mockResolvedValueOnce({ profile: { ...profile, id: "user-b", name: "Newer Name" } });

        const firstFetch = useAuthStore.getState().fetchUser();
        currentSession = { user: { id: "user-b" }, access_token: "token-b" };
        const secondFetch = useAuthStore.getState().fetchUser();
        await Promise.resolve();
        await Promise.resolve();
        await secondFetch;
        rejectA(new ApiError("Unauthorized", 401));
        await firstFetch;

        expect(getSpy).toHaveBeenCalledTimes(2);
        expect(authClient.auth.signOut).not.toHaveBeenCalled();
        expect(useAuthStore.getState().user).toMatchObject({ id: "user-b", name: "Newer Name" });
    });

    it("clears sealed answers during an explicit sign-out", async () => {
        useAuthStore.setState({ user: profile, sealedCount: 3, isAuthenticated: true } as any);

        await useAuthStore.getState().signOut();

        expect(useAuthStore.getState()).toMatchObject({
            user: null,
            sealedCount: 0,
            isAuthenticated: false,
        });
    });

    it("clears sealed answers when the auth listener clears the user", () => {
        useAuthStore.setState({ user: profile, sealedCount: 3, isAuthenticated: true } as any);

        useAuthStore.getState().setUser(null);

        expect(useAuthStore.getState()).toMatchObject({
            user: null,
            sealedCount: 0,
            isAuthenticated: false,
        });
    });

    it('keeps a pending Apple name scoped to its original subject', () => {
        useAuthStore.getState().setPendingAppleDisplayName({ userId: 'apple-user', name: 'Ada Lovelace' });
        useAuthStore.getState().clearPendingAppleDisplayName('other-user');

        expect(useAuthStore.getState().pendingAppleDisplayName).toEqual({ userId: 'apple-user', name: 'Ada Lovelace' });

        useAuthStore.getState().clearPendingAppleDisplayName('apple-user');
        expect(useAuthStore.getState().pendingAppleDisplayName).toBeNull();
    });
});
