import { isValidInviteCode, normalizeInviteCode, parseInviteLinkCode } from "../../lib/inviteLink";

describe("isValidInviteCode", () => {
    it("accepts 8-character alphanumeric codes case-insensitively", () => {
        expect(isValidInviteCode("ABCD1234")).toBe(true);
        expect(isValidInviteCode("abcd1234")).toBe(true);
    });

    it("rejects codes with the wrong length or characters", () => {
        expect(isValidInviteCode("ABC123")).toBe(false); // too short
        expect(isValidInviteCode("ABCD12345")).toBe(false); // too long
        expect(isValidInviteCode("ABCD-123")).toBe(false); // invalid character
        expect(isValidInviteCode("")).toBe(false);
        expect(isValidInviteCode(null)).toBe(false);
        expect(isValidInviteCode(undefined)).toBe(false);
    });
});

describe("normalizeInviteCode", () => {
    it("trims and uppercases", () => {
        expect(normalizeInviteCode("  abcd1234  ")).toBe("ABCD1234");
    });
});

describe("parseInviteLinkCode", () => {
    it("parses a universal link", () => {
        expect(parseInviteLinkCode("https://sauci.app/join/abcd1234")).toEqual({
            code: "ABCD1234",
            source: "universal_link",
        });
    });

    it("parses a universal link with a trailing slash", () => {
        expect(parseInviteLinkCode("https://sauci.app/join/abcd1234/")).toEqual({
            code: "ABCD1234",
            source: "universal_link",
        });
    });

    it("parses a custom scheme link", () => {
        expect(parseInviteLinkCode("app.sauci://join?code=abcd1234")).toEqual({
            code: "ABCD1234",
            source: "scheme",
        });
    });

    it("returns null for an unrelated https URL", () => {
        expect(parseInviteLinkCode("https://sauci.app/redeem")).toBeNull();
    });

    it("returns null for an unrelated host", () => {
        expect(parseInviteLinkCode("https://example.com/join/abcd1234")).toBeNull();
    });

    it("returns null for a custom scheme link with a badly-shaped code", () => {
        expect(parseInviteLinkCode("app.sauci://join?code=123")).toBeNull();
    });

    it("returns null for a custom scheme link missing the join host", () => {
        expect(parseInviteLinkCode("app.sauci://login?token=abc")).toBeNull();
    });

    it("returns null for garbage input", () => {
        expect(parseInviteLinkCode("not a url")).toBeNull();
        expect(parseInviteLinkCode(null)).toBeNull();
        expect(parseInviteLinkCode(undefined)).toBeNull();
        expect(parseInviteLinkCode("")).toBeNull();
    });
});
