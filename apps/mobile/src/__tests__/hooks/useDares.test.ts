import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useDares } from "@/features/dares/hooks/useDares";
import { ApiError, apiClient } from "@/lib/apiClient";
import type { UseDaresReturn } from "@/features/dares/hooks/useDares";
import type { SentDare } from "@/features/dares/types";

const incoming: SentDare = {
    id: "dare-1", couple_id: "couple-1", dare_id: "catalogue-1", text: "A dare", intensity: 2,
    is_custom: false, sender_id: "partner", recipient_id: "me", direction: "incoming",
    status: "pending", sender_notes: null, proof_type: "none", proof_media_id: null, sent_at: "2026-08-28T10:00:00.000Z",
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

    it("attaches proof media to a submit when one is supplied", async () => {
        mockLoad();
        const postSpy = jest.spyOn(apiClient, "post").mockResolvedValue({ dare: { ...incoming, status: "submitted" } } as never);
        const { result } = renderHook(() => useDares());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.submit("dare-1", "media-1");
        });
        expect(postSpy).toHaveBeenCalledWith("/v1/dares/dare-1/submit", { proof_media_id: "media-1" });

        await act(async () => {
            await result.current.submit("dare-1");
        });
        expect(postSpy).toHaveBeenLastCalledWith("/v1/dares/dare-1/submit", undefined);
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

describe("useDares polling cost", () => {
    /** Counts requests per endpoint and lets the active payload be swapped mid-test. */
    function mockCounting(active: () => SentDare[]) {
        const calls = { active: 0, history: 0, catalog: 0, stats: 0 };
        jest.spyOn(apiClient, "get").mockImplementation(async (path: string) => {
            if (path.startsWith("/v1/dares?filter=active")) { calls.active += 1; return { dares: active() } as never; }
            if (path.startsWith("/v1/dares?filter=history")) { calls.history += 1; return { dares: [] } as never; }
            if (path === "/v1/dares/packs") { calls.catalog += 1; return catalog as never; }
            if (path === "/v1/dares/stats") { calls.stats += 1; return stats as never; }
            throw new Error(`unexpected path ${path}`);
        });
        return calls;
    }

    const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
    const tick = async () => {
        await flush();
        await act(async () => { jest.advanceTimersByTime(5_000); });
        await flush();
    };

    beforeEach(() => { jest.restoreAllMocks(); jest.useFakeTimers(); });
    afterEach(() => jest.useRealTimers());

    it("polls the active list alone and re-reads the static endpoints only when it changes", async () => {
        let current: SentDare[] = [incoming];
        const calls = mockCounting(() => current);
        const { result } = renderHook(() => useDares({ isFocused: true }));
        await flush();
        expect(result.current.loading).toBe(false);
        // The first pass is a full load: nothing is cached yet.
        expect(calls).toEqual({ active: 1, history: 1, catalog: 1, stats: 1 });

        await tick();
        await tick();
        // Two quiet polls cost one request each, not four. The catalogue and the
        // stats cannot move while the active set is byte-for-byte identical.
        expect(calls).toEqual({ active: 3, history: 1, catalog: 1, stats: 1 });

        current = [{ ...incoming, status: "active" }];
        await tick();
        expect(calls).toEqual({ active: 4, history: 2, catalog: 2, stats: 2 });
        expect(result.current.active[0]?.status).toBe("active");

        await tick();
        expect(calls).toEqual({ active: 5, history: 2, catalog: 2, stats: 2 });
    });

    it("issues nothing at all while the screen is not on top", async () => {
        const calls = mockCounting(() => [incoming]);
        const { rerender } = renderHook<UseDaresReturn, { isFocused: boolean }>(
            ({ isFocused }) => useDares({ isFocused }),
            { initialProps: { isFocused: false } },
        );
        await tick();
        await tick();
        expect(calls).toEqual({ active: 0, history: 0, catalog: 0, stats: 0 });

        rerender({ isFocused: true });
        await flush();
        expect(calls).toEqual({ active: 1, history: 1, catalog: 1, stats: 1 });
    });

    it("never overlaps two polls", async () => {
        let release: (payload: { dares: SentDare[] }) => void = () => undefined;
        jest.spyOn(apiClient, "get").mockImplementation(async (path: string) => {
            if (path.startsWith("/v1/dares?filter=active")) return new Promise(resolve => { release = resolve; }) as never;
            return { dares: [], ...catalog, ...stats } as never;
        });
        renderHook(() => useDares({ isFocused: true }));
        await flush();
        await act(async () => { jest.advanceTimersByTime(20_000); });
        expect((apiClient.get as jest.Mock).mock.calls.filter(([path]) => String(path).includes("filter=active"))).toHaveLength(1);
        await act(async () => { release({ dares: [] }); await Promise.resolve(); });
    });
});
