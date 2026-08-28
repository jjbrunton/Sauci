import { useCallback, useEffect, useRef, useState } from "react";
import { daresApi } from "../../../lib/daresApi";
import { ApiError } from "../../../lib/apiClient";
import type { DareCatalog, DareStats, SendDarePayload, SentDare } from "../types";

/** Matches the chat poll cadence; the API has no realtime channel. */
const POLL_INTERVAL_MS = 5_000;

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
    submit: (dareId: string) => Promise<void>;
    complete: (dareId: string) => Promise<void>;
    cancel: (dareId: string) => Promise<void>;
}

export function useDares(): UseDaresReturn {
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

    const refresh = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            const [activeResult, historyResult, catalogResult, statsResult] = await Promise.all([
                daresApi.list("active"),
                daresApi.list("history"),
                daresApi.catalog(),
                daresApi.stats(),
            ]);
            if (!mountedRef.current) return;
            setActive(activeResult.dares);
            setHistory(historyResult.dares);
            setCatalog(catalogResult);
            setStats(statsResult);
            setError(null);
        } catch (cause) {
            if (mountedRef.current) {
                setError(cause instanceof ApiError ? cause.message : "Could not load dares");
            }
        } finally {
            fetchingRef.current = false;
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        void refresh();
        const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
        return () => {
            mountedRef.current = false;
            clearInterval(timer);
        };
    }, [refresh]);

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
        submit: useCallback((dareId) => act(dareId, () => daresApi.submit(dareId)), [act]),
        complete: useCallback((dareId) => act(dareId, () => daresApi.complete(dareId)), [act]),
        cancel: useCallback((dareId) => act(dareId, () => daresApi.cancel(dareId)), [act]),
    };
}
