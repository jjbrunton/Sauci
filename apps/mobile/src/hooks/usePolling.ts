import { useEffect, useRef } from 'react';
import { isForeground, subscribeToForeground } from '../lib/appForeground';

export interface UsePollingOptions {
    intervalMs: number;
    /** Caller-owned relevance: screen focus, a loaded id, a paired couple. */
    enabled?: boolean;
    /** Run once as soon as polling becomes active. Default true. */
    leading?: boolean;
    /** Ceiling for the exponential backoff applied after consecutive failures. */
    maxIntervalMs?: number;
    /**
     * Restarts the schedule when it changes, so a caller that switches subject —
     * a different chat, a different couple — gets an immediate run instead of
     * waiting out the interval left over from the previous one.
     */
    resetKey?: string | number;
}

/**
 * A recurring task with the three properties every poller in this app needs and
 * none of them had: it stops while the app is backgrounded, it never runs twice
 * concurrently, and it backs off instead of hammering an API that is failing.
 *
 * The next run is scheduled after the previous one settles rather than on a fixed
 * `setInterval`, so a slow response delays the next request instead of queueing
 * one behind it. `task` is read through a ref, so a caller may pass a fresh
 * closure every render without restarting the schedule.
 */
export function usePolling(task: () => Promise<void>, options: UsePollingOptions): void {
    const { intervalMs, enabled = true, leading = true, maxIntervalMs = intervalMs * 8, resetKey } = options;
    const taskRef = useRef(task);
    taskRef.current = task;

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        let running = false;
        let failures = 0;
        let foreground = isForeground();
        let timer: ReturnType<typeof setTimeout> | null = null;

        const clear = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        };
        const schedule = () => {
            if (cancelled || !foreground || timer !== null) return;
            const delay = Math.min(intervalMs * 2 ** failures, maxIntervalMs);
            timer = setTimeout(() => {
                timer = null;
                void run();
            }, delay);
        };
        const run = async () => {
            if (cancelled || running || !foreground) return;
            running = true;
            try {
                await taskRef.current();
                failures = 0;
            } catch {
                failures += 1;
            } finally {
                running = false;
                schedule();
            }
        };
        const unsubscribe = subscribeToForeground((next) => {
            if (next === foreground) return;
            foreground = next;
            if (!foreground) {
                clear();
                return;
            }
            // Back from the background: the cached data is as stale as the absence
            // was long, so catch up now rather than after another full interval.
            failures = 0;
            void run();
        });

        if (leading) void run();
        else schedule();

        return () => {
            cancelled = true;
            clear();
            unsubscribe();
        };
    }, [enabled, intervalMs, leading, maxIntervalMs, resetKey]);
}
