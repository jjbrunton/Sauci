// Couples do not carry an explicit "paired" flag (see apps/api/src/domains/couples/schema.ts).
// Pairing is inferred from how many profiles currently reference the couple id, the same
// approach UsersPage already uses inline for the couple badge on a profile row.

export type CoupleStatus = 'paired' | 'pending';

/**
 * Derive whether a couple is fully paired from the number of profiles that
 * reference it. A couple starts with one member (the creator) and becomes
 * paired once a partner joins via invite code.
 */
export function coupleStatusFromMemberCount(memberCount: number): CoupleStatus {
    return memberCount >= 2 ? 'paired' : 'pending';
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CoupleSearchFilter =
    | { column: 'id'; op: 'eq'; value: string }
    | { column: 'invite_code'; op: 'ilike'; value: string }
    | null;

/**
 * Build the admin query filter for the couples search box. A UUID-shaped
 * search term is treated as an exact id lookup; anything else is matched
 * against the invite code with a case-insensitive partial match.
 */
export function buildCoupleSearchFilter(rawSearch: string): CoupleSearchFilter {
    const search = rawSearch.trim();
    if (!search) return null;
    if (UUID_PATTERN.test(search)) {
        return { column: 'id', op: 'eq', value: search };
    }
    return { column: 'invite_code', op: 'ilike', value: `%${search}%` };
}
