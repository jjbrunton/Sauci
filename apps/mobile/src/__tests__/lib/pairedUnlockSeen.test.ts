jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPairedUnlockSeen, hasSeenPairedUnlock, markPairedUnlockSeen } from "../../lib/pairedUnlockSeen";

describe("paired unlock state", () => {
    it("is scoped to both account and couple", async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue("true");
        await hasSeenPairedUnlock("user-a", "couple-a");
        await markPairedUnlockSeen("user-a", "couple-a");
        await clearPairedUnlockSeen("user-a", "couple-a");
        expect(AsyncStorage.getItem).toHaveBeenCalledWith("paired_unlock_seen_user-a_couple-a");
        expect(AsyncStorage.setItem).toHaveBeenCalledWith("paired_unlock_seen_user-a_couple-a", "true");
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("paired_unlock_seen_user-a_couple-a");
    });
});
