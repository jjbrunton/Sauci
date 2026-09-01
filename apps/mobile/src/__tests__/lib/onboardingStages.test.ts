import { activeOnboardingStage, initialOnboardingStage, previousOnboardingStage } from '@/lib/onboardingStages';

describe('initialOnboardingStage', () => {
    it('starts at gender when a profile already has an Apple-supplied name', () => {
        expect(initialOnboardingStage('Ada Lovelace')).toBe('gender');
    });

    it('starts at name as a fallback when no name is available', () => {
        expect(initialOnboardingStage('  ')).toBe('name');
        expect(initialOnboardingStage(null)).toBe('name');
    });

    it('does not provide a back destination before the first reachable stage', () => {
        expect(previousOnboardingStage('name', false)).toBeNull();
        expect(previousOnboardingStage('gender', true)).toBeNull();
    });

    it('allows backwards navigation only through reachable stages', () => {
        expect(previousOnboardingStage('gender', false)).toBe('name');
        expect(previousOnboardingStage('purpose', true)).toBe('gender');
        expect(previousOnboardingStage('notifications', false)).toBe('purpose');
    });

    it('keeps first-auth onboarding out of the name screen only while its subject-keyed name is pending', () => {
        expect(activeOnboardingStage('name', null, 'Ada Lovelace')).toBe('gender');
        expect(activeOnboardingStage('name', null, undefined)).toBe('name');
    });
});
