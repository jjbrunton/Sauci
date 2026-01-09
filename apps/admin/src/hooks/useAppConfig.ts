import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config';

export interface AppConfig {
    id: string;
    answer_gap_threshold: number;
    daily_response_limit: number;
    updated_at: string | null;
    updated_by: string | null;
}

interface UseAppConfigReturn {
    config: AppConfig | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    updateConfig: (updates: Partial<AppConfig>) => Promise<{ error: string | null }>;
}

// Cache for the config to avoid refetching on every use
let cachedConfig: AppConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useAppConfig(): UseAppConfigReturn {
    const [config, setConfig] = useState<AppConfig | null>(cachedConfig);
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
                .from('app_config')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (fetchError) {
                setError(fetchError.message);
                setConfig(null);
            } else if (data) {
                cachedConfig = data as AppConfig;
                cacheTimestamp = Date.now();
                setConfig(data as AppConfig);
            } else {
                // No config row exists yet
                setConfig(null);
                setError('App config not initialized. Please contact support.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch app config');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateConfig = useCallback(async (updates: Partial<AppConfig>): Promise<{ error: string | null }> => {
        if (!config?.id) {
            return { error: 'No config to update' };
        }

        try {
            const { error: updateError } = await supabase
                .from('app_config')
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
            return { error: err instanceof Error ? err.message : 'Failed to update app config' };
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
 * Clear the config cache (useful when logging out)
 */
export function clearAppConfigCache(): void {
    cachedConfig = null;
    cacheTimestamp = 0;
}
