import { formatAppleProfileName } from '@/lib/appleProfileName';

describe('formatAppleProfileName', () => {
    it('combines Apple name parts into the profile display name', () => {
        expect(formatAppleProfileName({
            givenName: '  Ada ',
            middleName: '  Lovelace',
            familyName: ' Byron  ',
        })).toBe('Ada Lovelace Byron');
    });

    it('returns null when Apple has not supplied a usable name', () => {
        expect(formatAppleProfileName({ givenName: ' \n\t ' })).toBeNull();
        expect(formatAppleProfileName(null)).toBeNull();
    });

    it('removes control characters and stays within the profile contract limit', () => {
        expect(formatAppleProfileName({ givenName: 'Ada\u0000 Lovelace' })).toBe('Ada Lovelace');
        expect(formatAppleProfileName({ givenName: 'a'.repeat(101) })).toHaveLength(100);
    });
});
