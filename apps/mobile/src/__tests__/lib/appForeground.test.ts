import { AppState } from 'react-native';
import { isForeground, isForegroundState, subscribeToForeground } from '@/lib/appForeground';

describe('appForeground', () => {
    afterEach(() => jest.restoreAllMocks());

    it('treats only background and inactive as away', () => {
        expect(isForegroundState('active')).toBe(true);
        expect(isForegroundState('background')).toBe(false);
        expect(isForegroundState('inactive')).toBe(false);
        // Unknown states — including whatever a test harness leaves behind — must
        // fail towards running, never towards disabling recurring work forever.
        expect(isForegroundState(undefined)).toBe(true);
        expect(isForegroundState('extension')).toBe(true);
    });

    it('reads the current state and reports transitions until unsubscribed', () => {
        let emit: (state: string) => void = () => undefined;
        const remove = jest.fn();
        jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: (state: string) => void) => {
            emit = handler;
            return { remove } as never;
        }) as never);

        expect(isForeground()).toBe(isForegroundState(AppState.currentState));

        const seen: boolean[] = [];
        const unsubscribe = subscribeToForeground(value => seen.push(value));
        emit('background');
        emit('active');
        expect(seen).toEqual([false, true]);

        unsubscribe();
        expect(remove).toHaveBeenCalled();
    });
});
