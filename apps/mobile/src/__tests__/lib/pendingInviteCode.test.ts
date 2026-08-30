import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    stashPendingInviteCode,
    getPendingInviteCode,
    clearPendingInviteCode,
} from "../../lib/pendingInviteCode";

describe("pendingInviteCode", () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
    });

    it("stashes, retrieves, and clears a valid code", async () => {
        await stashPendingInviteCode("abcd1234");
        await expect(getPendingInviteCode()).resolves.toBe("ABCD1234");

        await clearPendingInviteCode();
        await expect(getPendingInviteCode()).resolves.toBeNull();
    });

    it("returns null when nothing has been stashed", async () => {
        await expect(getPendingInviteCode()).resolves.toBeNull();
    });

    it("ignores a stashed value that no longer matches the invite code shape", async () => {
        await AsyncStorage.setItem("pending_invite_code", "not-a-code");
        await expect(getPendingInviteCode()).resolves.toBeNull();
    });
});
