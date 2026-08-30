import { buildInviteShareMessage } from "../../lib/inviteShareCopy";

describe("buildInviteShareMessage", () => {
    it("leads with a plain invite when there are no sealed answers", () => {
        const message = buildInviteShareMessage("ABCD1234", 0);
        expect(message).toBe(
            "Join me on Sauci! Tap this link to pair up instantly: https://sauci.app/join/ABCD1234 (or enter code ABCD1234 in the app)"
        );
    });

    it("leads with earned value and singular wording for exactly one sealed answer", () => {
        const message = buildInviteShareMessage("ABCD1234", 1);
        expect(message).toBe(
            "Join me on Sauci! I have already answered 1 question about us. Tap this link to unlock them: https://sauci.app/join/ABCD1234 (or enter code ABCD1234 in the app)"
        );
    });

    it("pluralises for more than one sealed answer", () => {
        const message = buildInviteShareMessage("ABCD1234", 5);
        expect(message).toContain("I have already answered 5 questions about us.");
    });
});
