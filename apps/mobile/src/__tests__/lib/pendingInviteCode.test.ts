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

    it("stashes, retrieves, and clears a valid code for its owner", async () => {
        await stashPendingInviteCode("abcd1234", "user-a");
        await expect(getPendingInviteCode("user-a")).resolves.toBe("ABCD1234");

        await clearPendingInviteCode("user-a");
        await expect(getPendingInviteCode("user-a")).resolves.toBeNull();
    });

    it("returns null when nothing has been stashed", async () => {
        await expect(getPendingInviteCode("user-a")).resolves.toBeNull();
    });

    it("ignores a stashed value that no longer matches the invite code shape", async () => {
        await AsyncStorage.setItem("pending_invite_code", "not-a-code");
        await expect(getPendingInviteCode("user-a")).resolves.toBeNull();
    });

    it("does not leak a claimed invite to a later account", async () => {
        await stashPendingInviteCode("abcd1234");
        await expect(getPendingInviteCode("user-a")).resolves.toBe("ABCD1234");
        await expect(getPendingInviteCode("user-b")).resolves.toBeNull();

        await clearPendingInviteCode("user-b");
        await expect(getPendingInviteCode("user-a")).resolves.toBe("ABCD1234");
    });

    it("lets only one concurrently arriving account claim a pre-auth invite", async () => {
        await stashPendingInviteCode("abcd1234");

        const [first, second] = await Promise.all([
            getPendingInviteCode("user-a"),
            getPendingInviteCode("user-b"),
        ]);

        expect([first, second].filter(Boolean)).toHaveLength(1);
    });
});
