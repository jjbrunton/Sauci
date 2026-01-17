/**
 * Centralized error handling utility
 * Maps technical Supabase/API errors to user-friendly messages
 */

type ErrorCategory = 'auth' | 'pairing' | 'profile' | 'network' | 'generic';

interface ErrorMapping {
    pattern: RegExp | string;
    message: string;
}

const AUTH_ERROR_MAPPINGS: ErrorMapping[] = [
    { pattern: /invalid login credentials/i, message: "Incorrect email or password. Please try again." },
    { pattern: /email not confirmed/i, message: "Please verify your email before signing in." },
    { pattern: /user already registered/i, message: "An account with this email already exists." },
    { pattern: /email.*already.*(registered|exists|in use|used)/i, message: "This email is already in use. Please use a different one." },
    { pattern: /duplicate key value violates unique constraint.*users_email_key/i, message: "This email is already in use. Please use a different one." },
    { pattern: /invalid email/i, message: "Please enter a valid email address." },
    { pattern: /password.*too short/i, message: "Password must be at least 8 characters." },
    { pattern: /password.*too weak/i, message: "Please choose a stronger password." },
    { pattern: /rate limit/i, message: "Too many attempts. Please wait a moment and try again." },
    { pattern: /email rate limit/i, message: "Too many emails sent. Please wait before requesting another." },
    { pattern: /same as/i, message: "New password must be different from your current password." },
    { pattern: /session.*expired/i, message: "Your session has expired. Please log in again." },
    { pattern: /invalid.*token/i, message: "This link has expired. Please request a new one." },
    { pattern: /otp.*expired/i, message: "This code has expired. Please request a new one." },
    { pattern: /signups.*disabled/i, message: "Sign ups are currently disabled. Please try again later." },
    { pattern: /user not found/i, message: "No account found with this email." },
    { pattern: /provider.*disabled/i, message: "This sign-in method is currently unavailable." },
    { pattern: /manual.*link/i, message: "Saving accounts is temporarily unavailable. Please try again later." },
    { pattern: /identity.*link/i, message: "Saving accounts is temporarily unavailable. Please try again later." },
];

const PAIRING_ERROR_MAPPINGS: ErrorMapping[] = [
    { pattern: /invalid.*invite.*code/i, message: "This invite code is invalid. Please check and try again." },
    { pattern: /invite.*code.*not.*found/i, message: "This invite code doesn't exist. Please check with your partner." },
    { pattern: /already.*paired/i, message: "You're already paired with a partner." },
    { pattern: /couple.*full/i, message: "This couple already has two partners." },
    { pattern: /cannot.*join.*own/i, message: "You can't join your own couple." },
];

const PROFILE_ERROR_MAPPINGS: ErrorMapping[] = [
    { pattern: /profile.*not.*found/i, message: "Profile not found. Please try logging in again." },
    { pattern: /duplicate.*name/i, message: "This name is already taken." },
];

const NETWORK_ERROR_MAPPINGS: ErrorMapping[] = [
    { pattern: /network.*error/i, message: "Connection problem. Please check your internet and try again." },
    { pattern: /fetch.*failed/i, message: "Couldn't connect to server. Please try again." },
    { pattern: /timeout/i, message: "Request timed out. Please try again." },
    { pattern: /abort/i, message: "Request was cancelled. Please try again." },
];

const GENERIC_FALLBACK = "Something went wrong. Please try again.";

/**
 * Get a user-friendly error message from a Supabase/API error
 */
export function getUserFriendlyError(
    error: Error | { message: string } | string | null | undefined,
    category: ErrorCategory = 'generic'
): string {
    if (!error) return GENERIC_FALLBACK;

    const errorMessage = typeof error === 'string' ? error : error.message;
    if (!errorMessage) return GENERIC_FALLBACK;

    // Check category-specific mappings first
    const categoryMappings = getCategoryMappings(category);
    for (const mapping of categoryMappings) {
        if (matchesPattern(errorMessage, mapping.pattern)) {
            return mapping.message;
        }
    }

    // Check network errors (applies to all categories)
    for (const mapping of NETWORK_ERROR_MAPPINGS) {
        if (matchesPattern(errorMessage, mapping.pattern)) {
            return mapping.message;
        }
    }

    // Check auth errors if in auth category
    if (category === 'auth') {
        for (const mapping of AUTH_ERROR_MAPPINGS) {
            if (matchesPattern(errorMessage, mapping.pattern)) {
                return mapping.message;
            }
        }
    }

    // Return generic fallback instead of raw error
    return GENERIC_FALLBACK;
}

function getCategoryMappings(category: ErrorCategory): ErrorMapping[] {
    switch (category) {
        case 'auth':
            return AUTH_ERROR_MAPPINGS;
        case 'pairing':
            return PAIRING_ERROR_MAPPINGS;
        case 'profile':
            return PROFILE_ERROR_MAPPINGS;
        case 'network':
            return NETWORK_ERROR_MAPPINGS;
        default:
            return [];
    }
}

function matchesPattern(message: string, pattern: RegExp | string): boolean {
    if (typeof pattern === 'string') {
        return message.toLowerCase().includes(pattern.toLowerCase());
    }
    return pattern.test(message);
}

/**
 * Helper specifically for auth errors
 */
export function getAuthError(error: Error | { message: string } | string | null | undefined): string {
    return getUserFriendlyError(error, 'auth');
}

/**
 * Helper specifically for pairing/couple errors
 */
export function getPairingError(error: Error | { message: string } | string | null | undefined): string {
    return getUserFriendlyError(error, 'pairing');
}

/**
 * Helper specifically for profile errors
 */
export function getProfileError(error: Error | { message: string } | string | null | undefined): string {
    return getUserFriendlyError(error, 'profile');
}
