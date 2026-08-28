import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useDares } from "@/features/dares/hooks/useDares";
import { ApiError, apiClient } from "@/lib/apiClient";
import type { SentDare } from "@/features/dares/types";

const incoming: SentDare = {
    id: "dare-1", couple_id: "couple-1", dare_id: "catalogue-1", text: "A dare", intensity: 2,
    is_custom: false, sender_id: "partner", recipient_id: "me", direction: "incoming",
    status: "pending", sender_notes: null, sent_at: "2026-08-28T10:00:00.000Z",
    accepted_at: null, submitted_at: null, completed_at: null, expires_at: null,
};

const catalog = {
    entitlement: { is_premium: false, can_send_custom: false, weekly_send_limit: 3, sends_remaining: 2 },
    packs: [],
};

const stats = { sent: 1, received: 1, completed_together: 0, active: 1, completed_by_me: 0, completed_by_partner: 0 };

function mockLoad() {
    return jest.spyOn(apiClient, "get").mockImplementation(async (path: string) => {
        if (path.startsWith("/v1/dares?filter=active")) return { dares: [incoming] } as never;
        if (path.startsWith("/v1/dares?filter=history")) return { dares: [] } as never;
        if (path === "/v1/dares/packs") return catalog as never;
        if (path === "/v1/dares/stats") return stats as never;
        throw new Error(`unexpected path ${path}`);
    });
}

describe("useDares", () => {
    beforeEach(() => jest.restoreAllMocks());

    it("loads the inbox, catalogue and stats together", async () => {
        mockLoad();
        const { result } = renderHook(() => useDares());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.active).toHaveLength(1);
        expect(result.current.history).toHaveLength(0);
        expect(result.current.catalog?.entitlement.sends_remaining).toBe(2);
        expect(result.current.stats?.active).toBe(1);
        expect(result.current.error).toBeNull();
    });

    it("posts a response and refreshes", async () => {
        mockLoad();
        const postSpy = jest.spyOn(apiClient, "post").mockResolvedValue({ dare: { ...incoming, status: "active" } } as never);
        const { result } = renderHook(() => useDares());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.respond("dare-1", "accept");
        });
        expect(postSpy).toHaveBeenCalledWith("/v1/dares/dare-1/respond", { action: "accept" });
    });

    it("routes a premium refusal to the paywall rather than the error banner", async () => {
        mockLoad();
        jest.spyOn(apiClient, "post").mockRejectedValue(new ApiError("Custom dares require premium", 402));
        const { result } = renderHook(() => useDares());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.send({ custom_dare_text: "mine" });
        });
        expect(result.current.paywallReason).toBe("Custom dares require premium");
        expect(result.current.error).toBeNull();

        act(() => result.current.clearPaywall());
        expect(result.current.paywallReason).toBeNull();
    });

    it("surfaces non-premium failures inline", async () => {
        mockLoad();
        jest.spyOn(apiClient, "post").mockRejectedValue(new ApiError("A pending dare cannot change to submitted", 409));
        const { result } = renderHook(() => useDares());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.submit("dare-1");
        });
        expect(result.current.error).toBe("A pending dare cannot change to submitted");
        expect(result.current.paywallReason).toBeNull();
    });

    it("reports a load failure without crashing", async () => {
        jest.spyOn(apiClient, "get").mockRejectedValue(new ApiError("offline", 500));
        const { result } = renderHook(() => useDares());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe("offline");
    });
});
