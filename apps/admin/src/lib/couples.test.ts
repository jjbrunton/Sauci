import { describe, expect, it } from 'vitest';
import { buildCoupleSearchFilter, coupleStatusFromMemberCount } from './couples';

describe('coupleStatusFromMemberCount', () => {
    it('treats zero or one member as pending', () => {
        expect(coupleStatusFromMemberCount(0)).toBe('pending');
        expect(coupleStatusFromMemberCount(1)).toBe('pending');
    });

    it('treats two or more members as paired', () => {
        expect(coupleStatusFromMemberCount(2)).toBe('paired');
        expect(coupleStatusFromMemberCount(3)).toBe('paired');
    });
});

describe('buildCoupleSearchFilter', () => {
    it('returns null for an empty or blank search', () => {
        expect(buildCoupleSearchFilter('')).toBeNull();
        expect(buildCoupleSearchFilter('   ')).toBeNull();
    });

    it('matches a uuid-shaped search as an exact id filter', () => {
        expect(buildCoupleSearchFilter('a1b2c3d4-1111-1111-1111-111111111111')).toEqual({
            column: 'id', op: 'eq', value: 'a1b2c3d4-1111-1111-1111-111111111111',
        });
    });

    it('treats any other search as a partial invite code match', () => {
        expect(buildCoupleSearchFilter('SUNSET42')).toEqual({
            column: 'invite_code', op: 'ilike', value: '%SUNSET42%',
        });
    });

    it('trims surrounding whitespace before deciding the filter shape', () => {
        expect(buildCoupleSearchFilter('  sunset42  ')).toEqual({
            column: 'invite_code', op: 'ilike', value: '%sunset42%',
        });
    });
});
