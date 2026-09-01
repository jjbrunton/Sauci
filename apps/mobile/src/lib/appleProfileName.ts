export interface AppleProfileName {
    givenName?: string | null;
    middleName?: string | null;
    familyName?: string | null;
}

const MAX_PROFILE_NAME_LENGTH = 100;

/**
 * Apple supplies its name fields only on the first authorization. Keep that
 * user-provided value as the Sauci display name without retaining email or
 * other Apple credential fields outside the existing profile contract.
 */
export function formatAppleProfileName(fullName: AppleProfileName | null | undefined): string | null {
    const name = [fullName?.givenName, fullName?.middleName, fullName?.familyName]
        .filter((part): part is string => typeof part === "string")
        .join(" ")
        .normalize("NFKC")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .replace(/\s+/gu, " ")
        .trim();

    return name.length > 0 ? name.slice(0, MAX_PROFILE_NAME_LENGTH) : null;
}
