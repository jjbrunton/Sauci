import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/config';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SubscriptionStatus = 'SUBSCRIBED' | 'SUBSCRIBING' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export interface UseRealtimeSubscriptionOptions<T> {
    table: string;
    schema?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    filter?: string;
    onInsert?: (payload: T) => void;
    onUpdate?: (payload: { old: T; new: T }) => void;
    onDelete?: (payload: T) => void;
    insertToast?: {
        enabled: boolean;
        message: string | ((payload: T) => string);
        type?: 'success' | 'info' | 'warning';
    };
    updateToast?: {
        enabled: boolean;
        message: string | ((payload: { old: T; new: T }) => string);
        type?: 'success' | 'info' | 'warning';
    };
    deleteToast?: {
        enabled: boolean;
        message: string | ((payload: T) => string);
        type?: 'success' | 'info' | 'warning';
    };
    debounceMs?: number;
    enabled?: boolean;
}

export interface UseRealtimeSubscriptionReturn {
    status: SubscriptionStatus;
    error: Error | null;
}

const MAX_RETRIES = 3;

export function useRealtimeSubscription<T>(
    options: UseRealtimeSubscriptionOptions<T>
): UseRealtimeSubscriptionReturn {
    const {
        table,
        schema = 'public',
        event = '*',
        filter,
        onInsert,
        onUpdate,
        onDelete,
        insertToast,
        updateToast,
        deleteToast,
        debounceMs = 0,
        enabled = true,
    } = options;

    const [status, setStatus] = useState<SubscriptionStatus>('CLOSED');
    const [error, setError] = useState<Error | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const isMountedRef = useRef(true);

    // Use refs for callbacks and toast options to avoid re-subscription on every render
    const onInsertRef = useRef(onInsert);
    const onUpdateRef = useRef(onUpdate);
    const onDeleteRef = useRef(onDelete);
    const insertToastRef = useRef(insertToast);
    const updateToastRef = useRef(updateToast);
    const deleteToastRef = useRef(deleteToast);

    // Keep refs up to date
    useEffect(() => {
        onInsertRef.current = onInsert;
        onUpdateRef.current = onUpdate;
        onDeleteRef.current = onDelete;
        insertToastRef.current = insertToast;
        updateToastRef.current = updateToast;
        deleteToastRef.current = deleteToast;
    });

    // Debounced callback wrapper
    const debouncedCallback = useCallback(
        (callback: () => void) => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (debounceMs > 0) {
                debounceTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        callback();
                    }
                }, debounceMs);
            } else {
                callback();
            }
        },
        [debounceMs]
    );

    // Handle incoming changes - use refs to avoid dependency changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChange = useCallback(
        (payload: { eventType: string; new: any; old: any }) => {
            if (!isMountedRef.current) return;

            const eventType = payload.eventType;

            if (eventType === 'INSERT') {
                const newRecord = payload.new as T;

                if (insertToastRef.current?.enabled) {
                    const message =
                        typeof insertToastRef.current.message === 'function'
                            ? insertToastRef.current.message(newRecord)
                            : insertToastRef.current.message;
                    toast[insertToastRef.current.type || 'info'](message);
                }

                if (onInsertRef.current) {
                    debouncedCallback(() => onInsertRef.current!(newRecord));
                }
            }

            if (eventType === 'UPDATE') {
                const updatePayload = { old: payload.old as T, new: payload.new as T };

                if (updateToastRef.current?.enabled) {
                    const message =
                        typeof updateToastRef.current.message === 'function'
                            ? updateToastRef.current.message(updatePayload)
                            : updateToastRef.current.message;
                    toast[updateToastRef.current.type || 'info'](message);
                }

                if (onUpdateRef.current) {
                    debouncedCallback(() => onUpdateRef.current!(updatePayload));
                }
            }

            if (eventType === 'DELETE') {
                const deletedRecord = payload.old as T;

                if (deleteToastRef.current?.enabled) {
                    const message =
                        typeof deleteToastRef.current.message === 'function'
                            ? deleteToastRef.current.message(deletedRecord)
                            : deleteToastRef.current.message;
                    toast[deleteToastRef.current.type || 'info'](message);
                }

                if (onDeleteRef.current) {
                    debouncedCallback(() => onDeleteRef.current!(deletedRecord));
                }
            }
        },
        [debouncedCallback]
    );

    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled) {
            setStatus('CLOSED');
            return;
        }

        const subscribe = () => {
            // Create unique channel name
            const channelName = `admin-${table}-${filter || 'all'}-${Date.now()}`;

            // Build subscription config
            const subscriptionConfig: {
                event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
                schema: string;
                table: string;
                filter?: string;
            } = {
                event,
                schema,
                table,
            };

            if (filter) {
                subscriptionConfig.filter = filter;
            }

            setStatus('SUBSCRIBING');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const channel = (supabase.channel(channelName) as any)
                .on('postgres_changes', subscriptionConfig, handleChange)
                .subscribe((subscriptionStatus: string) => {
                    if (!isMountedRef.current) return;

                    if (subscriptionStatus === 'SUBSCRIBED') {
                        setStatus('SUBSCRIBED');
                        setError(null);
                        retryCountRef.current = 0;
                    } else if (subscriptionStatus === 'CHANNEL_ERROR') {
                        setStatus('CHANNEL_ERROR');
                        setError(new Error(`Failed to subscribe to ${table}`));

                        // Auto-retry with exponential backoff
                        if (retryCountRef.current < MAX_RETRIES) {
                            const timeout = Math.pow(2, retryCountRef.current) * 1000;
                            retryCountRef.current++;
                            setTimeout(() => {
                                if (isMountedRef.current && channelRef.current) {
                                    supabase.removeChannel(channelRef.current);
                                    subscribe();
                                }
                            }, timeout);
                        }
                    } else if (subscriptionStatus === 'TIMED_OUT') {
                        setStatus('TIMED_OUT');
                        setError(new Error(`Subscription to ${table} timed out`));
                    } else if (subscriptionStatus === 'CLOSED') {
                        setStatus('CLOSED');
                    }
                });

            channelRef.current = channel;
        };

        subscribe();

        return () => {
            isMountedRef.current = false;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [enabled, table, schema, event, filter, handleChange]);

    return { status, error };
}
