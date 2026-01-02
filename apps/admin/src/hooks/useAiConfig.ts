import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config';

export interface CouncilGenerator {
    model: string;
}

export type CouncilSelectionMode = 'whole_set' | 'cherry_pick';

export interface AiConfig {
    id: string;
    openrouter_api_key: string | null;
    default_model: string | null;
    model_generate: string | null;
    model_fix: string | null;
    model_polish: string | null;
    council_enabled: boolean;
    council_generator_model: string | null; // Legacy - kept for backwards compatibility
    council_generators: CouncilGenerator[] | null; // New array of generators
    council_reviewer_model: string | null;
    council_selection_mode: CouncilSelectionMode | null; // 'whole_set' or 'cherry_pick'
    cherry_pick_ensure_intensity_distribution: boolean | null; // Balance intensity levels in cherry-pick mode
    classifier_enabled: boolean | null;
    classifier_model: string | null;
    classifier_prompt: string | null;
    updated_at: string | null;
    updated_by: string | null;
}

interface UseAiConfigReturn {
    config: AiConfig | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    updateConfig: (updates: Partial<AiConfig>) => Promise<{ error: string | null }>;
}

// Cache for the config to avoid refetching on every use
let cachedConfig: AiConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useAiConfig(): UseAiConfigReturn {
    const [config, setConfig] = useState<AiConfig | null>(cachedConfig);
    const [loading, setLoading] = useState(!cachedConfig);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        // Use cache if valid
        if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL) {
            setConfig(cachedConfig);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('ai_config')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (fetchError) {
                // If user doesn't have access (not super admin), that's expected
                if (fetchError.code === 'PGRST116' || fetchError.message.includes('permission')) {
                    setError('Access denied. Super admin privileges required.');
                } else {
                    setError(fetchError.message);
                }
                setConfig(null);
            } else if (data) {
                cachedConfig = data as AiConfig;
                cacheTimestamp = Date.now();
                setConfig(data as AiConfig);
            } else {
                // No config row exists yet
                setConfig(null);
                setError('AI config not initialized. Please contact support.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch AI config');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateConfig = useCallback(async (updates: Partial<AiConfig>): Promise<{ error: string | null }> => {
        if (!config?.id) {
            return { error: 'No config to update' };
        }

        try {
            const { error: updateError } = await supabase
                .from('ai_config')
                .update(updates)
                .eq('id', config.id);

            if (updateError) {
                return { error: updateError.message };
            }

            // Invalidate cache and refetch
            cachedConfig = null;
            cacheTimestamp = 0;
            await fetchConfig();

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Failed to update AI config' };
        }
    }, [config?.id, fetchConfig]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    return {
        config,
        loading,
        error,
        refetch: fetchConfig,
        updateConfig,
    };
}

/**
 * Get the cached AI config synchronously (for use in openai.ts)
 * Returns null if not yet loaded
 */
export function getCachedAiConfig(): AiConfig | null {
    return cachedConfig;
}

/**
 * Preload the AI config (call this on app init)
 */
export async function preloadAiConfig(): Promise<AiConfig | null> {
    if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL) {
        return cachedConfig;
    }

    try {
        const { data } = await supabase
            .from('ai_config')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (data) {
            cachedConfig = data as AiConfig;
            cacheTimestamp = Date.now();
            return cachedConfig;
        }
    } catch {
        // Silently fail - we'll fall back to env vars
    }

    return null;
}

/**
 * Clear the config cache (useful when logging out)
 */
export function clearAiConfigCache(): void {
    cachedConfig = null;
    cacheTimestamp = 0;
}
