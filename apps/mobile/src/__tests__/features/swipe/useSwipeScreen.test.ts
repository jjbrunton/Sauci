import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useSwipeScreen } from "@/features/swipe/hooks/useSwipeScreen";
import { ApiError, apiClient } from "@/lib/apiClient";
import * as swipeService from "@/features/swipe/services/swipeService";
import { getSkippedQuestionIds } from "@/lib/skippedQuestions";

let mockRouteParams: Record<string, string> = {};
const mockFetchStreak = jest.fn(async () => undefined);
jest.mock("expo-router", () => ({
    useLocalSearchParams: () => mockRouteParams,
    useFocusEffect: () => undefined,
}));

// Stable identities: the hook's effects key off these, so fresh objects per render
// would retrigger the fetch effect forever and the screen would never settle.
jest.mock("@/store", () => {
    const auth = { user: { id: "user-1" }, partner: { id: "user-2" }, couple: { id: "couple-1", couple_id: "couple-1" } };
    const packs = { enabledPackIds: ["pack-1"], ensureEnabledPacksLoaded: async () => undefined, packs: [] };
    const packState = { ...packs, invalidatePacks: jest.fn() };
    const responses = { invalidateResponses: jest.fn() };
    const useAuthStore = () => auth;
    useAuthStore.getState = () => auth.user;
    const usePacksStore = () => packs;
    usePacksStore.getState = () => packState;
    const useResponsesStore = () => responses;
    useResponsesStore.getState = () => responses;
    // Read lazily: the factory runs before this module's own consts are initialised.
    const streak = { fetchStreak: () => mockFetchStreak() };
    const useStreakStore = () => streak;
    useStreakStore.getState = () => streak;
    return { useAuthStore, usePacksStore, useResponsesStore, useStreakStore };
});

jest.mock("@/lib/skippedQuestions", () => ({
    skipQuestion: jest.fn(),
    getSkippedQuestionIds: jest.fn(),
}));

jest.mock("@/features/swipe/services/swipeService", () => ({
    fetchRecommendedQuestions: jest.fn(),
    fetchPendingQuestions: jest.fn(),
    fetchAnswerGapStatus: jest.fn(),
    fetchDailyLimitStatus: jest.fn(),
    fetchPackContext: jest.fn(),
    uploadResponseMedia: jest.fn(),
}));

const questions = [
    { id: "q1", pack_id: "pack-1", question_type: "swipe", text: "One" },
    { id: "q2", pack_id: "pack-1", question_type: "swipe", text: "Two" },
];

const futureResetAt = "2099-08-29T00:00:00.000Z";

const openLimit = {
    responses_today: 4,
    limit_value: 10,
    remaining: 6,
    reset_at: futureResetAt,
    is_blocked: false,
};

const dailyLimit429 = () => new ApiError("Daily response limit reached", 429, {
    error: { code: "daily_limit", message: "Daily response limit reached" },
    details: { daily_limit: 10, responses_today: 10, remaining: 0, reset_at: futureResetAt },
});

// clearMocks wipes implementations between tests, so re-arm the whole surface each time.
beforeEach(() => {
    mockRouteParams = {};
    jest.mocked(getSkippedQuestionIds).mockResolvedValue(new Set<string>());
    jest.mocked(swipeService.fetchRecommendedQuestions).mockResolvedValue(questions as never);
    jest.mocked(swipeService.fetchAnswerGapStatus).mockResolvedValue({
        unanswered_by_partner: 0, threshold: 10, is_blocked: false,
    });
    jest.mocked(swipeService.fetchDailyLimitStatus).mockResolvedValue(openLimit);
});

const renderReady = async () => {
    const view = renderHook(() => useSwipeScreen());
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    await waitFor(() => expect(view.result.current.dailyLimitInfo).not.toBeNull());
    return view;
};

describe("useSwipeScreen daily limit", () => {
    it("holds the question and shows the wall when the server rejects with 429", async () => {
        const { result } = await renderReady();
        expect(result.current.currentIndex).toBe(0);

        jest.spyOn(apiClient, "post").mockRejectedValueOnce(dailyLimit429());
        await act(async () => {
            await result.current.handleAnswer("q1", "yes");
        });

        // Advancing here would silently discard the question the server refused.
        expect(result.current.currentIndex).toBe(0);
        expect(result.current.dailyLimitInfo).toMatchObject({
            responses_today: 10,
            limit_value: 10,
            remaining: 0,
            reset_at: futureResetAt,
            is_blocked: true,
        });
    });

    it("still advances past an unrelated submission failure", async () => {
        const { result } = await renderReady();

        jest.spyOn(apiClient, "post").mockRejectedValueOnce(new ApiError("Server error", 500, null));
        await act(async () => {
            await result.current.handleAnswer("q1", "yes");
        });

        expect(result.current.currentIndex).toBe(1);
        expect(result.current.dailyLimitInfo?.is_blocked).toBe(false);
    });

    it("still reports the limit while browsing a single pack", async () => {
        // Pack browsing used to skip the limit read, which showed "all caught up"
        // to a capped user instead of the limit screen.
        mockRouteParams = { packId: "pack-1" };
        jest.mocked(swipeService.fetchPackContext).mockResolvedValue({ name: "Pack", icon: "layers" });
        jest.mocked(swipeService.fetchRecommendedQuestions).mockResolvedValue([] as never);
        jest.mocked(swipeService.fetchDailyLimitStatus).mockResolvedValue({
            ...openLimit, responses_today: 10, remaining: 0, is_blocked: true,
        });

        const { result } = renderHook(() => useSwipeScreen());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await waitFor(() => expect(result.current.dailyLimitInfo?.is_blocked).toBe(true));
    });

    it("counts down the meter optimistically on a successful answer", async () => {
        const { result } = await renderReady();

        jest.spyOn(apiClient, "post").mockResolvedValueOnce({ match: null });
        jest.mocked(swipeService.fetchDailyLimitStatus)
            .mockResolvedValue({ ...openLimit, responses_today: 5, remaining: 5 });
        await act(async () => {
            await result.current.handleAnswer("q1", "yes");
        });

        expect(result.current.currentIndex).toBe(1);
        expect(result.current.dailyLimitInfo).toMatchObject({ responses_today: 5, remaining: 5 });
    });

    it("refreshes the shared streak once the answer lands", async () => {
        const { result } = await renderReady();
        mockFetchStreak.mockClear();

        jest.spyOn(apiClient, "post").mockResolvedValueOnce({ match: null });
        await act(async () => {
            await result.current.handleAnswer("q1", "yes");
        });

        expect(mockFetchStreak).toHaveBeenCalled();
    });

    it("records the answer even when the streak refresh throws", async () => {
        // A refresh that fails outright must not cost the user the answer they just gave.
        const { result } = await renderReady();
        mockFetchStreak.mockImplementationOnce(() => { throw new Error("offline"); });

        jest.spyOn(apiClient, "post").mockResolvedValueOnce({ match: null });
        jest.mocked(swipeService.fetchDailyLimitStatus)
            .mockResolvedValue({ ...openLimit, responses_today: 5, remaining: 5 });
        await act(async () => {
            await result.current.handleAnswer("q1", "yes");
        });

        expect(result.current.currentIndex).toBe(1);
        expect(result.current.dailyLimitInfo).toMatchObject({ responses_today: 5, remaining: 5 });
    });
});
