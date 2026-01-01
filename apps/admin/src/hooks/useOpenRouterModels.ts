import { useState, useEffect, useCallback, useMemo } from 'react';

export interface OpenRouterModel {
    id: string;
    name: string;
    description: string;
    context_length: number;
    pricing: {
        prompt: string;
        completion: string;
    };
    top_provider?: {
        max_completion_tokens?: number;
    };
}

interface UseOpenRouterModelsReturn {
    models: OpenRouterModel[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

// Cache for models list
let cachedModels: OpenRouterModel[] = [];
let modelsCacheTimestamp: number = 0;
const MODELS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - models don't change often

// Popular/recommended models to show at top
const FEATURED_MODEL_IDS = [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'google/gemini-pro-1.5',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.1-405b-instruct',
    'deepseek/deepseek-chat',
];

export function useOpenRouterModels(): UseOpenRouterModelsReturn {
    const [models, setModels] = useState<OpenRouterModel[]>(cachedModels);
    const [loading, setLoading] = useState(cachedModels.length === 0);
    const [error, setError] = useState<string | null>(null);

    const fetchModels = useCallback(async () => {
        // Use cache if valid
        if (cachedModels.length > 0 && Date.now() - modelsCacheTimestamp < MODELS_CACHE_TTL) {
            setModels(cachedModels);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // OpenRouter's models endpoint is public, no auth needed
            const response = await fetch('https://openrouter.ai/api/v1/models');

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json();

            // Filter to only text models and sort by featured + name
            const textModels: OpenRouterModel[] = (data.data || [])
                .filter((m: OpenRouterModel) => {
                    // Filter out image-only, audio-only models
                    const id = m.id.toLowerCase();
                    return !id.includes('dall-e') &&
                           !id.includes('stable-diffusion') &&
                           !id.includes('midjourney') &&
                           !id.includes('whisper') &&
                           !id.includes('tts');
                })
                .map((m: OpenRouterModel) => ({
                    id: m.id,
                    name: m.name,
                    description: m.description || '',
                    context_length: m.context_length || 0,
                    pricing: m.pricing || { prompt: '0', completion: '0' },
                    top_provider: m.top_provider,
                }))
                .sort((a: OpenRouterModel, b: OpenRouterModel) => {
                    // Featured models first
                    const aFeatured = FEATURED_MODEL_IDS.indexOf(a.id);
                    const bFeatured = FEATURED_MODEL_IDS.indexOf(b.id);

                    if (aFeatured !== -1 && bFeatured !== -1) {
                        return aFeatured - bFeatured;
                    }
                    if (aFeatured !== -1) return -1;
                    if (bFeatured !== -1) return 1;

                    // Then alphabetically by name
                    return a.name.localeCompare(b.name);
                });

            cachedModels = textModels;
            modelsCacheTimestamp = Date.now();
            setModels(textModels);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch models');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    return {
        models,
        loading,
        error,
        refetch: fetchModels,
    };
}

/**
 * Hook variant that provides filtered model suggestions
 */
export function useModelSuggestions(searchQuery: string, maxResults: number = 20) {
    const { models, loading, error } = useOpenRouterModels();

    const filteredModels = useMemo(() => {
        if (!searchQuery.trim()) {
            // Return featured models when no search
            return models.slice(0, maxResults);
        }

        const query = searchQuery.toLowerCase();
        return models
            .filter(m =>
                m.id.toLowerCase().includes(query) ||
                m.name.toLowerCase().includes(query)
            )
            .slice(0, maxResults);
    }, [models, searchQuery, maxResults]);

    return {
        models: filteredModels,
        allModels: models,
        loading,
        error,
    };
}

/**
 * Format pricing for display
 */
export function formatModelPricing(model: OpenRouterModel): string {
    const promptCost = parseFloat(model.pricing.prompt) * 1000000;
    const completionCost = parseFloat(model.pricing.completion) * 1000000;

    if (promptCost === 0 && completionCost === 0) {
        return 'Free';
    }

    return `$${promptCost.toFixed(2)}/$${completionCost.toFixed(2)} per 1M tokens`;
}

/**
 * Format context length for display
 */
export function formatContextLength(contextLength: number): string {
    if (contextLength >= 1000000) {
        return `${(contextLength / 1000000).toFixed(1)}M`;
    }
    if (contextLength >= 1000) {
        return `${Math.round(contextLength / 1000)}K`;
    }
    return contextLength.toString();
}

/**
 * Get cached models synchronously
 */
export function getCachedModels(): OpenRouterModel[] {
    return cachedModels;
}

/**
 * Preload models (call on app init)
 */
export async function preloadOpenRouterModels(): Promise<void> {
    if (cachedModels.length > 0 && Date.now() - modelsCacheTimestamp < MODELS_CACHE_TTL) {
        return;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (response.ok) {
            const data = await response.json();
            cachedModels = (data.data || [])
                .filter((m: OpenRouterModel) => {
                    const id = m.id.toLowerCase();
                    return !id.includes('dall-e') &&
                           !id.includes('stable-diffusion') &&
                           !id.includes('midjourney') &&
                           !id.includes('whisper') &&
                           !id.includes('tts');
                })
                .map((m: OpenRouterModel) => ({
                    id: m.id,
                    name: m.name,
                    description: m.description || '',
                    context_length: m.context_length || 0,
                    pricing: m.pricing || { prompt: '0', completion: '0' },
                    top_provider: m.top_provider,
                }));
            modelsCacheTimestamp = Date.now();
        }
    } catch {
        // Silently fail - we'll show manual input as fallback
    }
}
