import { hasSeenGuestAccountWarning, markGuestAccountWarningSeen } from "@/lib/guestAccountWarningSeen";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("guestAccountWarningSeen", () => {
    beforeEach(() => {
        return AsyncStorage.clear();
    });

    it("persists a dismissal for that anonymous account", async () => {
        await markGuestAccountWarningSeen("guest-1");

        await expect(hasSeenGuestAccountWarning("guest-1")).resolves.toBe(true);
    });

    it("does not suppress the recovery warning for a later guest account", async () => {
        await markGuestAccountWarningSeen("guest-1");

        await expect(hasSeenGuestAccountWarning("guest-2")).resolves.toBe(false);
    });
});
