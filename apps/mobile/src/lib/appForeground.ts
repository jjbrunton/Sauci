import { AppState, type AppStateStatus } from 'react-native';

/**
 * `background` is a real suspension and `inactive` is the moment behind the app
 * switcher, a call, or a system prompt. Anything else — including states a test
 * harness never sets — counts as foreground, so recurring work fails towards
 * running rather than towards being silently disabled forever.
 */
export function isForegroundState(state: AppStateStatus | string | undefined): boolean {
    return state !== 'background' && state !== 'inactive';
}

export function isForeground(): boolean {
    return isForegroundState(AppState.currentState as AppStateStatus | undefined);
}

/** Reports the new foreground flag on every transition. Returns an unsubscribe. */
export function subscribeToForeground(onChange: (foreground: boolean) => void): () => void {
    const subscription = AppState.addEventListener('change', (state) => onChange(isForegroundState(state)));
    return () => subscription.remove();
}
