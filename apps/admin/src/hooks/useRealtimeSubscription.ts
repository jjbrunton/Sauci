import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { queryAdminRows, type AdminFilter } from '@/lib/adminApi';

export type SubscriptionStatus = 'SUBSCRIBED' | 'SUBSCRIBING' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
export interface UseRealtimeSubscriptionOptions<T> {
    table: string; schema?: string; event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'; filter?: string;
    onInsert?: (payload: T) => void; onUpdate?: (payload: { old: T; new: T }) => void; onDelete?: (payload: T) => void;
    insertToast?: { enabled: boolean; message: string | ((payload: T) => string); type?: 'success' | 'info' | 'warning' };
    updateToast?: { enabled: boolean; message: string | ((payload: { old: T; new: T }) => string); type?: 'success' | 'info' | 'warning' };
    deleteToast?: { enabled: boolean; message: string | ((payload: T) => string); type?: 'success' | 'info' | 'warning' };
    debounceMs?: number; enabled?: boolean; pollIntervalMs?: number;
}
export interface UseRealtimeSubscriptionReturn { status: SubscriptionStatus; error: Error | null }

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const MIN_POLL_INTERVAL_MS = 5_000;

function parseFilter(filter?: string): AdminFilter[] | undefined {
    if (!filter) return undefined;
    const match = /^([a-z_][a-z0-9_]*)=(eq|neq|gte|lte)\.(.+)$/.exec(filter);
    return match ? [{ column: match[1], op: match[2] as AdminFilter['op'], value: match[3] }] : undefined;
}

function rowKey(row: unknown, index: number): string {
    if (row && typeof row === 'object') {
        const record = row as Record<string, unknown>;
        const key = record.id ?? `${record.pack_id ?? ''}:${record.topic_id ?? ''}`;
        if (key) return String(key);
    }
    return String(index);
}

export function useRealtimeSubscription<T>(options: UseRealtimeSubscriptionOptions<T>): UseRealtimeSubscriptionReturn {
    const { table, event = '*', filter, onInsert, onUpdate, onDelete, insertToast, updateToast, deleteToast,
        debounceMs = 0, enabled = true, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = options;
    const [status, setStatus] = useState<SubscriptionStatus>('CLOSED');
    const [error, setError] = useState<Error | null>(null);
    const snapshotRef = useRef<Map<string, { value: T; json: string }> | null>(null);
    const callbacksRef = useRef({ onInsert, onUpdate, onDelete, insertToast, updateToast, deleteToast });
    callbacksRef.current = { onInsert, onUpdate, onDelete, insertToast, updateToast, deleteToast };
    const emit = useCallback((callback: () => void) => {
        if (debounceMs <= 0) callback(); else window.setTimeout(callback, debounceMs);
    }, [debounceMs]);

    useEffect(() => {
        if (!enabled) { setStatus('CLOSED'); return; }
        let cancelled = false;
        let timer: number | undefined;
        const interval = Math.max(MIN_POLL_INTERVAL_MS, pollIntervalMs);
        const poll = async () => {
            if (document.visibilityState === 'hidden') { timer = window.setTimeout(poll, interval); return; }
            try {
                setStatus((current) => current === 'SUBSCRIBED' ? current : 'SUBSCRIBING');
                const { rows } = await queryAdminRows<T>(table, { filters: parseFilter(filter), limit: 500 });
                if (cancelled) return;
                const next = new Map(rows.map((row, index) => [rowKey(row, index), { value: row, json: JSON.stringify(row) }]));
                const previous = snapshotRef.current;
                if (previous) {
                    if (event === '*' || event === 'INSERT') for (const [key, entry] of next) if (!previous.has(key)) {
                        const config = callbacksRef.current;
                        if (config.insertToast?.enabled) toast[config.insertToast.type || 'info'](typeof config.insertToast.message === 'function' ? config.insertToast.message(entry.value) : config.insertToast.message);
                        if (config.onInsert) emit(() => config.onInsert!(entry.value));
                    }
                    if (event === '*' || event === 'UPDATE') for (const [key, entry] of next) {
                        const old = previous.get(key);
                        if (old && old.json !== entry.json) {
                            const payload = { old: old.value, new: entry.value };
                            const config = callbacksRef.current;
                            if (config.updateToast?.enabled) toast[config.updateToast.type || 'info'](typeof config.updateToast.message === 'function' ? config.updateToast.message(payload) : config.updateToast.message);
                            if (config.onUpdate) emit(() => config.onUpdate!(payload));
                        }
                    }
                    if (event === '*' || event === 'DELETE') for (const [key, entry] of previous) if (!next.has(key)) {
                        const config = callbacksRef.current;
                        if (config.deleteToast?.enabled) toast[config.deleteToast.type || 'info'](typeof config.deleteToast.message === 'function' ? config.deleteToast.message(entry.value) : config.deleteToast.message);
                        if (config.onDelete) emit(() => config.onDelete!(entry.value));
                    }
                }
                snapshotRef.current = next;
                setStatus('SUBSCRIBED'); setError(null);
            } catch (cause) {
                if (!cancelled) { setStatus('CHANNEL_ERROR'); setError(cause instanceof Error ? cause : new Error(String(cause))); }
            } finally {
                if (!cancelled) timer = window.setTimeout(poll, interval);
            }
        };
        void poll();
        return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); snapshotRef.current = null; };
    }, [emit, enabled, event, filter, pollIntervalMs, table]);
    return { status, error };
}
