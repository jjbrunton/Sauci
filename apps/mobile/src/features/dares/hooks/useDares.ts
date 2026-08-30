import { useCallback, useEffect, useRef, useState } from "react";
import { daresApi } from "../../../lib/daresApi";
import { ApiError } from "../../../lib/apiClient";
import { usePolling } from "../../../hooks/usePolling";
import type { DareCatalog, DareStats, SendDarePayload, SentDare } from "../types";

/** Matches the chat poll cadence; the API has no realtime channel. */
const POLL_INTERVAL_MS = 5_000;

export interface UseDaresConfig {
    /**
     * Supplied by the screen rather than read from navigation here, so the hook
     * stays renderable without a navigator. Polling stops when the screen is not
     * on top; `usePolling` additionally stops it when the app backgrounds.
     */
    isFocused?: boolean;
}

export interface UseDaresReturn {
    active: SentDare[];
    history: SentDare[];
    catalog: DareCatalog | null;
    stats: DareStats | null;
    loading: boolean;
    busyDareId: string | null;
    error: string | null;
    /** Set when an action was refused for want of premium, so the screen can open the paywall. */
    paywallReason: string | null;
    clearPaywall: () => void;
    refresh: () => Promise<void>;
    send: (payload: SendDarePayload) => Promise<boolean>;
    respond: (dareId: string, action: "accept" | "decline") => Promise<void>;
    submit: (dareId: string, proofMediaId?: string) => Promise<void>;
    complete: (dareId: string) => Promise<void>;
    cancel: (dareId: string) => Promise<void>;
}

/**
 * Identity of the active set as the user experiences it. History, stats and the
 * remaining-send allowance only move when a dare enters or leaves this set or
 * changes status, so this is the signal that says the slower endpoints are worth
 * re-reading.
 */
const activeSignature = (dares: SentDare[]): string =>
    dares
        .map(dare => `${dare.id}:${dare.status}`)
        .sort()
        .join("|");

export function useDares({ isFocused = true }: UseDaresConfig = {}): UseDaresReturn {
    const [active, setActive] = useState<SentDare[]>([]);
    const [history, setHistory] = useState<SentDare[]>([]);
    const [catalog, setCatalog] = useState<DareCatalog | null>(null);
    const [stats, setStats] = useState<DareStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyDareId, setBusyDareId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [paywallReason, setPaywallReason] = useState<string | null>(null);
    const fetchingRef = useRef(false);
    const mountedRef = useRef(true);
    const signatureRef = useRef<string | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    /**
     * `full` reads everything; the polling path reads only the active list and
     * follows up on the rest when that list actually changed. A failure updates
     * the UI's error state either way, but is only rethrown for the poll path
     * (`throwOnError`): `usePolling` needs the rejection to drive its backoff,
     * while pull-to-refresh and post-mutation callers already surface the error
     * themselves and must not turn it into an unhandled rejection.
     */
    const load = useCallback(async (full: boolean, throwOnError = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            const activeResult = await daresApi.list("active");
            if (!mountedRef.current) return;
            setActive(activeResult.dares);

            const signature = activeSignature(activeResult.dares);
            const changed = signature !== signatureRef.current;
            signatureRef.current = signature;

            if (full || changed) {
                const [historyResult, catalogResult, statsResult] = await Promise.all([
                    daresApi.list("history"),
                    daresApi.catalog(),
                    daresApi.stats(),
                ]);
                if (!mountedRef.current) return;
                setHistory(historyResult.dares);
                setCatalog(catalogResult);
                setStats(statsResult);
            }
            setError(null);
        } catch (cause) {
            if (mountedRef.current) {
                setError(cause instanceof ApiError ? cause.message : "Could not load dares");
            }
            if (throwOnError) throw cause;
        } finally {
            fetchingRef.current = false;
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    /** Pull-to-refresh and post-mutation reloads always read the slow endpoints too. */
    const refresh = useCallback(() => load(true), [load]);
    const poll = useCallback(() => load(false, true), [load]);

    usePolling(poll, { intervalMs: POLL_INTERVAL_MS, enabled: isFocused });

    /** Premium refusals steer to the paywall; everything else surfaces inline. */
    const handleFailure = useCallback((cause: unknown) => {
        if (cause instanceof ApiError && (cause.status === 402 || cause.status === 403)) {
            setPaywallReason(cause.message);
            return;
        }
        setError(cause instanceof ApiError ? cause.message : "Something went wrong");
    }, []);

    const act = useCallback(
        async (dareId: string, operation: () => Promise<unknown>) => {
            setBusyDareId(dareId);
            try {
                await operation();
                await refresh();
            } catch (cause) {
                handleFailure(cause);
            } finally {
                if (mountedRef.current) setBusyDareId(null);
            }
        },
        [refresh, handleFailure],
    );

    const send = useCallback(
        async (payload: SendDarePayload) => {
            try {
                await daresApi.send(payload);
                await refresh();
                return true;
            } catch (cause) {
                handleFailure(cause);
                return false;
            }
        },
        [refresh, handleFailure],
    );

    return {
        active,
        history,
        catalog,
        stats,
        loading,
        busyDareId,
        error,
        paywallReason,
        clearPaywall: useCallback(() => setPaywallReason(null), []),
        refresh,
        send,
        respond: useCallback((dareId, action) => act(dareId, () => daresApi.respond(dareId, action)), [act]),
        submit: useCallback((dareId, proofMediaId) => act(dareId, () => daresApi.submit(dareId, proofMediaId)), [act]),
        complete: useCallback((dareId) => act(dareId, () => daresApi.complete(dareId)), [act]),
        cancel: useCallback((dareId) => act(dareId, () => daresApi.cancel(dareId)), [act]),
    };
}
