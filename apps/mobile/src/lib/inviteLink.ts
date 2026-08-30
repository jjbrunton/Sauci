// Shared invite code shape and deep-link parsing for the invite funnel.
//
// Two link forms carry an invite code into the app:
//   - Universal/App Link: https://sauci.app/join/{code}
//   - Custom scheme link: app.sauci://join?code={code}
//
// Both forms are handled by the root layout's deep link listener and by the
// pairing screen when it receives a `code` route param.

export const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_PATTERN = /^[A-Z0-9]{8}$/;

export type InviteLinkSource = "universal_link" | "scheme";

export interface ParsedInviteLink {
    code: string;
    source: InviteLinkSource;
}

/**
 * Returns true when `code` (case-insensitive) matches the 8-character
 * alphanumeric invite code shape used across the app.
 */
export function isValidInviteCode(code: string | null | undefined): boolean {
    if (!code) return false;
    return INVITE_CODE_PATTERN.test(code.trim().toUpperCase());
}

/**
 * Normalizes a raw invite code string to the canonical uppercase form used
 * for display, storage, and API calls.
 */
export function normalizeInviteCode(code: string): string {
    return code.trim().toUpperCase();
}

/**
 * Parses an incoming URL for an invite code, supporting both the universal
 * link form (https://sauci.app/join/{code}) and the custom scheme form
 * (app.sauci://join?code={code}). Returns null when the URL does not carry a
 * recognizable, validly-shaped invite code.
 */
export function parseInviteLinkCode(url: string | null | undefined): ParsedInviteLink | null {
    if (!url) return null;

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    let rawCode: string | null = null;
    let source: InviteLinkSource | null = null;

    if (parsed.protocol === "https:" && parsed.hostname === "sauci.app") {
        const match = parsed.pathname.match(/^\/join\/([^/]+)\/?$/);
        if (match) {
            rawCode = match[1];
            source = "universal_link";
        }
    } else if (parsed.protocol === "app.sauci:") {
        const host = parsed.hostname || parsed.pathname.replace(/^\/+/, "");
        if (host === "join") {
            rawCode = parsed.searchParams.get("code");
            source = "scheme";
        }
    }

    if (!rawCode || !source) return null;

    const code = normalizeInviteCode(rawCode);
    if (!isValidInviteCode(code)) return null;

    return { code, source };
}
