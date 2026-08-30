import * as Clipboard from "expo-clipboard";
import {
    checkClipboardForInviteCode,
    __resetClipboardInviteOfferForTests,
} from "../../lib/clipboardInviteOffer";

jest.mock("expo-clipboard", () => ({
    hasStringAsync: jest.fn(),
    getStringAsync: jest.fn(),
}));

const hasStringAsync = Clipboard.hasStringAsync as jest.Mock;
const getStringAsync = Clipboard.getStringAsync as jest.Mock;

describe("checkClipboardForInviteCode", () => {
    beforeEach(() => {
        __resetClipboardInviteOfferForTests();
        hasStringAsync.mockReset();
        getStringAsync.mockReset();
    });

    it("returns a normalized code when the clipboard holds a validly-shaped code", async () => {
        hasStringAsync.mockResolvedValue(true);
        getStringAsync.mockResolvedValue("abcd1234");

        await expect(checkClipboardForInviteCode()).resolves.toBe("ABCD1234");
    });

    it("returns null when the clipboard is empty", async () => {
        hasStringAsync.mockResolvedValue(false);

        await expect(checkClipboardForInviteCode()).resolves.toBeNull();
        expect(getStringAsync).not.toHaveBeenCalled();
    });

    it("returns null when the clipboard string does not match the invite code shape", async () => {
        hasStringAsync.mockResolvedValue(true);
        getStringAsync.mockResolvedValue("hello world");

        await expect(checkClipboardForInviteCode()).resolves.toBeNull();
    });

    it("only checks the clipboard once per session", async () => {
        hasStringAsync.mockResolvedValue(true);
        getStringAsync.mockResolvedValue("abcd1234");

        await expect(checkClipboardForInviteCode()).resolves.toBe("ABCD1234");
        expect(hasStringAsync).toHaveBeenCalledTimes(1);

        // A second call in the same session should not re-check the clipboard.
        await expect(checkClipboardForInviteCode()).resolves.toBeNull();
        expect(hasStringAsync).toHaveBeenCalledTimes(1);
    });
});
