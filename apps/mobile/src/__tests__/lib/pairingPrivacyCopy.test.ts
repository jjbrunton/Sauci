import { PAIRING_PRIVACY_SUMMARY } from "../../lib/pairingPrivacyCopy";

describe("PAIRING_PRIVACY_SUMMARY", () => {
    it("explains what each response style reveals before a user answers", () => {
        expect(PAIRING_PRIVACY_SUMMARY).toContain("Vote-style answers reveal shared outcomes");
        expect(PAIRING_PRIVACY_SUMMARY).toContain("Text, audio, photo, and who-likely responses are shown after you both answer");
    });
});
