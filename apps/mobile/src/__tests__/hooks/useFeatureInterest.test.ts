import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useFeatureInterest } from "@/hooks/useFeatureInterest";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

describe("useFeatureInterest", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ user: { id: "user1" } } as any);
    });

    it("reads interest state from the API", async () => {
        const getSpy = jest.spyOn(apiClient, "get").mockResolvedValueOnce({ feature: "live draw", interested: true });
        const { result } = renderHook(() => useFeatureInterest("live draw"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(getSpy).toHaveBeenCalledWith("/v1/me/feature-interests/live%20draw");
        expect(result.current.isInterested).toBe(true);
        expect(result.current.isAuthenticated).toBe(true);
    });

    it("does not call the API without a product user", async () => {
        useAuthStore.setState({ user: null } as any);
        const getSpy = jest.spyOn(apiClient, "get");
        const { result } = renderHook(() => useFeatureInterest("dares"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isAuthenticated).toBe(false);
        expect(getSpy).not.toHaveBeenCalled();
    });

    it("adds interest through PUT", async () => {
        jest.spyOn(apiClient, "get").mockResolvedValueOnce({ feature: "dares", interested: false });
        const putSpy = jest.spyOn(apiClient, "put").mockResolvedValueOnce({ feature: "dares", interested: true });
        const { result } = renderHook(() => useFeatureInterest("dares"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => result.current.toggleInterest());

        expect(putSpy).toHaveBeenCalledWith("/v1/me/feature-interests/dares");
        expect(result.current.isInterested).toBe(true);
        expect(result.current.isToggling).toBe(false);
    });

    it("removes interest through DELETE", async () => {
        jest.spyOn(apiClient, "get").mockResolvedValueOnce({ feature: "dares", interested: true });
        const deleteSpy = jest.spyOn(apiClient, "delete").mockResolvedValueOnce({ feature: "dares", interested: false });
        const { result } = renderHook(() => useFeatureInterest("dares"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => result.current.toggleInterest());

        expect(deleteSpy).toHaveBeenCalledWith("/v1/me/feature-interests/dares");
        expect(result.current.isInterested).toBe(false);
    });

    it("reverts its optimistic state when the API fails", async () => {
        jest.spyOn(apiClient, "get").mockResolvedValueOnce({ feature: "dares", interested: false });
        jest.spyOn(apiClient, "put").mockRejectedValueOnce(new Error("API unavailable"));
        const { result } = renderHook(() => useFeatureInterest("dares"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => result.current.toggleInterest());

        expect(result.current.isInterested).toBe(false);
        expect(result.current.isToggling).toBe(false);
    });
});
