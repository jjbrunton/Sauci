import { act, renderHook } from '@testing-library/react-native';
import { usePolling } from '@/hooks/usePolling';

const mockForeground = { value: true };
const mockListeners = new Set<(foreground: boolean) => void>();

jest.mock('@/lib/appForeground', () => ({
    isForeground: () => mockForeground.value,
    subscribeToForeground: (listener: (foreground: boolean) => void) => {
        mockListeners.add(listener);
        return () => { mockListeners.delete(listener); };
    },
}));

const setForeground = async (value: boolean) => {
    await act(async () => {
        mockForeground.value = value;
        for (const listener of [...mockListeners]) listener(value);
    });
};
// The next run is scheduled once the previous one settles, so let pending
// promises land before and after moving the clock.
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const tick = async (ms: number) => {
    await flush();
    await act(async () => { jest.advanceTimersByTime(ms); });
    await flush();
};

describe('usePolling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockForeground.value = true;
        mockListeners.clear();
    });
    afterEach(() => jest.useRealTimers());

    it('runs once immediately and then on the interval', async () => {
        const task = jest.fn(async () => undefined);
        renderHook(() => usePolling(task, { intervalMs: 100 }));
        expect(task).toHaveBeenCalledTimes(1);
        await tick(100);
        expect(task).toHaveBeenCalledTimes(2);
        await tick(100);
        expect(task).toHaveBeenCalledTimes(3);
    });

    it('skips the leading run when asked to', async () => {
        const task = jest.fn(async () => undefined);
        renderHook(() => usePolling(task, { intervalMs: 100, leading: false }));
        expect(task).not.toHaveBeenCalled();
        await tick(100);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('issues nothing while disabled and starts once enabled', async () => {
        const task = jest.fn(async () => undefined);
        const { rerender } = renderHook<void, { enabled: boolean }>(({ enabled }) => usePolling(task, { intervalMs: 100, enabled }), {
            initialProps: { enabled: false },
        });
        await tick(1_000);
        expect(task).not.toHaveBeenCalled();
        rerender({ enabled: true });
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('stops while the app is backgrounded and catches up on return', async () => {
        const task = jest.fn(async () => undefined);
        renderHook(() => usePolling(task, { intervalMs: 100 }));
        expect(task).toHaveBeenCalledTimes(1);

        await setForeground(false);
        await tick(1_000);
        expect(task).toHaveBeenCalledTimes(1);

        await setForeground(true);
        expect(task).toHaveBeenCalledTimes(2);
        await tick(100);
        expect(task).toHaveBeenCalledTimes(3);
    });

    it('never runs two tasks concurrently', async () => {
        let release!: () => void;
        const task = jest.fn(() => new Promise<void>(resolve => { release = resolve; }));
        renderHook(() => usePolling(task, { intervalMs: 100 }));
        expect(task).toHaveBeenCalledTimes(1);

        await tick(500);
        expect(task).toHaveBeenCalledTimes(1);

        await act(async () => { release(); });
        await tick(100);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('backs off after consecutive failures and recovers after a success', async () => {
        const task = jest.fn(async (): Promise<void> => { throw new Error('offline'); });
        renderHook(() => usePolling(task, { intervalMs: 100, maxIntervalMs: 400 }));
        expect(task).toHaveBeenCalledTimes(1);

        await tick(100);
        expect(task).toHaveBeenCalledTimes(1);
        await tick(100);
        expect(task).toHaveBeenCalledTimes(2);

        await tick(399);
        expect(task).toHaveBeenCalledTimes(2);
        await tick(1);
        expect(task).toHaveBeenCalledTimes(3);

        task.mockImplementation(async () => undefined);
        await tick(400);
        expect(task).toHaveBeenCalledTimes(4);
        await tick(100);
        expect(task).toHaveBeenCalledTimes(5);
    });

    it('restarts immediately when the reset key changes', async () => {
        const task = jest.fn(async () => undefined);
        const { rerender } = renderHook<void, { resetKey: string }>(({ resetKey }) => usePolling(task, { intervalMs: 100, resetKey }), {
            initialProps: { resetKey: 'a' },
        });
        expect(task).toHaveBeenCalledTimes(1);
        rerender({ resetKey: 'b' });
        expect(task).toHaveBeenCalledTimes(2);
        await tick(50);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('stops and unsubscribes on unmount', async () => {
        const task = jest.fn(async () => undefined);
        const { unmount } = renderHook(() => usePolling(task, { intervalMs: 100 }));
        await tick(100);
        expect(task).toHaveBeenCalledTimes(2);
        unmount();
        expect(mockListeners.size).toBe(0);
        await tick(1_000);
        expect(task).toHaveBeenCalledTimes(2);
    });
});
