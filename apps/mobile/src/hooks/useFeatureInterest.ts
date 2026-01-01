import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store";

export function useFeatureInterest(featureName: string) {
    const [isInterested, setIsInterested] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const user = useAuthStore((state) => state.user);

    // Fetch current interest status
    useEffect(() => {
        async function fetchInterest() {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            const { data } = await supabase
                .from("feature_interests")
                .select("id")
                .eq("user_id", user.id)
                .eq("feature_name", featureName)
                .maybeSingle();

            setIsInterested(!!data);
            setIsLoading(false);
        }

        fetchInterest();
    }, [user?.id, featureName]);

    const toggleInterest = useCallback(async () => {
        if (!user?.id || isToggling) return;

        setIsToggling(true);
        const wasInterested = isInterested;

        // Optimistic update
        setIsInterested(!wasInterested);

        try {
            if (wasInterested) {
                // Remove interest
                const { error } = await supabase
                    .from("feature_interests")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("feature_name", featureName);

                if (error) throw error;
            } else {
                // Add interest
                const { error } = await supabase
                    .from("feature_interests")
                    .insert({
                        user_id: user.id,
                        feature_name: featureName,
                    });

                if (error) throw error;
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
