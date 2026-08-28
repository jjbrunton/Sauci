import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../store";

interface FeatureInterestResponse {
    feature: string;
    interested: boolean;
}

export function useFeatureInterest(featureName: string) {
    const [isInterested, setIsInterested] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const user = useAuthStore((state) => state.user);

    // Fetch current interest status
    useEffect(() => {
        let cancelled = false;

        async function fetchInterest() {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const result = await apiClient.get<FeatureInterestResponse>(
                    `/v1/me/feature-interests/${encodeURIComponent(featureName)}`,
                );
                if (!cancelled) setIsInterested(result.interested);
            } catch (error) {
                console.error("Error fetching feature interest:", error);
                if (!cancelled) setIsInterested(false);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchInterest();

        return () => {
            cancelled = true;
        };
    }, [user?.id, featureName]);

    const toggleInterest = useCallback(async () => {
        if (!user?.id || isToggling) return;

        setIsToggling(true);
        const wasInterested = isInterested;

        // Optimistic update
        setIsInterested(!wasInterested);

        try {
            if (wasInterested) {
                await apiClient.delete<FeatureInterestResponse>(
                    `/v1/me/feature-interests/${encodeURIComponent(featureName)}`,
                );
            } else {
                await apiClient.put<FeatureInterestResponse>(
                    `/v1/me/feature-interests/${encodeURIComponent(featureName)}`,
                );
            }
        } catch (error) {
            console.error("Error toggling feature interest:", error);
            // Revert on error
            setIsInterested(wasInterested);
        } finally {
            setIsToggling(false);
        }
    }, [user?.id, featureName, isInterested, isToggling]);

    return {
        isInterested,
        isLoading,
        isToggling,
        toggleInterest,
        isAuthenticated: !!user?.id,
    };
}
