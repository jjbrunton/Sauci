import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { daresApi } from "../../../lib/daresApi";

/**
 * Lightweight counterpart to `useDares` for the home tile: one request on focus
 * rather than the four-endpoint poll the full screen runs.
 */
export function useIncomingDareCount(enabled: boolean): number {
    const [count, setCount] = useState(0);

    useFocusEffect(
        useCallback(() => {
            if (!enabled) return;
            let cancelled = false;
            daresApi
                .list("active")
                .then((result) => {
                    if (cancelled) return;
                    setCount(
                        result.dares.filter(
                            (dare) => dare.direction === "incoming" && dare.status === "pending",
                        ).length,
                    );
                })
                .catch(() => undefined);
            return () => {
                cancelled = true;
            };
        }, [enabled]),
    );

    return count;
}
