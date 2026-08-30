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
        // fetchUser always fetches couple state now, since it also carries the
        // sealed answer count for a user who has no couple yet. Individual tests
        // override this when they care about the couple/partner shape.
        jest.spyOn(coupleApi, "getState").mockResolvedValue({ couple: null, partner: null, sealed_count: 0 });
        useAuthStore.setState({
            user: null,
            couple: null,
            partner: null,
            sealedCount: 0,
            isLoading: true,
            isAuthenticated: false,
            isAnonymous: false,
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
            data: { session: { user: { id: "me", is_anonymous: true } } },
        });
        const getSpy = jest.spyOn(apiClient, "get").mockResolvedValueOnce({ profile });

        await useAuthStore.getState().fetchUser();

        expect(getSpy).toHaveBeenCalledWith("/v1/me");
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
        (authClient.auth.getSession as jest.Mock).mockResolvedValueOnce({
            data: { session: { user: { id: "me" } } },
        });
        jest.spyOn(apiClient, "get").mockRejectedValueOnce(new ApiError("Unauthorized", 401));
        (authClient.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

        await useAuthStore.getState().fetchUser();

        expect(useAuthStore.getState()).toMatchObject({
            user: null,
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
});
