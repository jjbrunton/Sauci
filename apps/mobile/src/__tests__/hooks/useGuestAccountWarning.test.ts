import { act, renderHook, waitFor } from "@testing-library/react-native";
import { hasSeenGuestAccountWarning, markGuestAccountWarningSeen } from "@/lib/guestAccountWarningSeen";
import { useGuestAccountWarning } from "@/hooks/useGuestAccountWarning";

jest.mock("@/lib/guestAccountWarningSeen", () => ({
    hasSeenGuestAccountWarning: jest.fn(),
    markGuestAccountWarningSeen: jest.fn(),
}));

const options = {
    isAuthenticated: true,
    isAnonymous: true,
    userId: "guest-1",
    pathname: "/(app)/pairing",
};

describe("useGuestAccountWarning", () => {
    beforeEach(() => {
        jest.mocked(hasSeenGuestAccountWarning).mockReset();
        jest.mocked(markGuestAccountWarningSeen).mockReset();
    });

    it("does not reopen after a dismissal while the durable write is pending", async () => {
        let finishMarking: (() => void) | undefined;
        jest.mocked(hasSeenGuestAccountWarning).mockResolvedValue(false);
        jest.mocked(markGuestAccountWarningSeen).mockImplementation(() => new Promise<void>((resolve) => {
            finishMarking = resolve;
        }));

        const { result, rerender } = renderHook((props: typeof options) => useGuestAccountWarning(props), { initialProps: options });

        await waitFor(() => expect(result.current.visible).toBe(true));

        let dismissal: Promise<void> | undefined;
        act(() => {
            dismissal = result.current.dismiss();
        });

        expect(result.current.visible).toBe(false);

        rerender({ ...options, pathname: "/(app)/settings" });
        expect(result.current.visible).toBe(false);
        expect(hasSeenGuestAccountWarning).toHaveBeenCalledTimes(1);

        finishMarking?.();
        await act(async () => {
            await dismissal;
        });
    });

    it("checks once per anonymous account and can warn a later guest account", async () => {
        jest.mocked(hasSeenGuestAccountWarning).mockResolvedValue(false);

        const { result, rerender } = renderHook((props: typeof options) => useGuestAccountWarning(props), { initialProps: options });

        await waitFor(() => expect(result.current.visible).toBe(true));
        rerender({ ...options, pathname: "/(app)/settings" });
        expect(hasSeenGuestAccountWarning).toHaveBeenCalledTimes(1);

        await act(async () => {
            await result.current.dismiss();
        });

        rerender({ ...options, userId: "guest-2" });
        await waitFor(() => expect(hasSeenGuestAccountWarning).toHaveBeenCalledWith("guest-2"));
        await waitFor(() => expect(result.current.visible).toBe(true));
    });
});
