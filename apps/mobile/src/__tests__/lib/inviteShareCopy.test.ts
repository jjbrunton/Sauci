import { buildInviteShareMessage } from "../../lib/inviteShareCopy";

describe("buildInviteShareMessage", () => {
    it("keeps a recoverable bare code in a separate sentence", () => {
        const message = buildInviteShareMessage("AB12CD34", 3);
        expect(message).toContain("https://sauci.app/join/AB12CD34");
        expect(message).toContain("enter code AB12CD34 in Sauci");
        expect(message).toContain("compare our answers together");
    });

    it("does not claim a sealed outcome before answers exist", () => {
        expect(buildInviteShareMessage("AB12CD34", 0)).not.toContain("unlock");
    });
});
