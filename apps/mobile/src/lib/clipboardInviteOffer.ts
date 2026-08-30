// Deferred hand-off fallback: when a user copies an invite code on another
// device (e.g. from the web join page) then opens the app, offer to use the
// code found on the clipboard. Never auto-applies the code; the caller must
// present a confirmation before using the result. Only checks once per app
// session so the user is not repeatedly prompted.

import * as Clipboard from "expo-clipboard";
import { isValidInviteCode, normalizeInviteCode } from "./inviteLink";

let hasCheckedThisSession = false;

/**
 * Checks the clipboard once per session for a string matching the invite
 * code shape. Returns the normalized code, or null when there is nothing
 * usable (or the check already ran this session).
 */
export async function checkClipboardForInviteCode(): Promise<string | null> {
    if (hasCheckedThisSession) return null;
    hasCheckedThisSession = true;

    try {
        const hasString = await Clipboard.hasStringAsync();
        if (!hasString) return null;

        const value = await Clipboard.getStringAsync();
        if (value && isValidInviteCode(value)) {
            return normalizeInviteCode(value);
        }
    } catch (error) {
        console.error("Error checking clipboard for invite code:", error);
    }

    return null;
}

/** Test-only helper to reset the per-session gating between test cases. */
export function __resetClipboardInviteOfferForTests(): void {
    hasCheckedThisSession = false;
}
