// =============================================================================
// OpenAI Client Initialization
// Handles client creation, caching, and model selection
// =============================================================================

import OpenAI from 'openai';
import { getCachedAiConfig } from '@/hooks/useAiConfig';
import type { ModelPurpose } from './types';

// Cache for the OpenAI instance to avoid recreating on every call
let cachedOpenAI: OpenAI | null = null;
let cachedApiKey: string | null = null;

/**
 * Get or create an OpenAI client instance
 * Uses OpenRouter API by default, falls back to direct OpenAI
 */
export function getOpenAI(): OpenAI {
    // First, try to get API key from remote config
    const remoteConfig = getCachedAiConfig();
    const remoteKey = remoteConfig?.openrouter_api_key;

    // Fall back to env vars if remote config not available
    const openRouterKey = remoteKey || import.meta.env.VITE_OPENROUTER_API_KEY;
    const openAIKey = import.meta.env.VITE_OPENAI_API_KEY;

    // Check if we can reuse cached instance
    if (cachedOpenAI && cachedApiKey === openRouterKey) {
        return cachedOpenAI;
    }

    if (openRouterKey) {
        cachedOpenAI = new OpenAI({
            apiKey: openRouterKey,
            baseURL: 'https://openrouter.ai/api/v1',
            dangerouslyAllowBrowser: true,
        });
        cachedApiKey = openRouterKey;
        return cachedOpenAI;
    }

    if (!openAIKey) {
        throw new Error('OpenRouter API key not configured. Please configure it in AI Settings or set VITE_OPENROUTER_API_KEY environment variable.');
    }

    cachedOpenAI = new OpenAI({
        apiKey: openAIKey,
        dangerouslyAllowBrowser: true,
    });
    cachedApiKey = openAIKey;
    return cachedOpenAI;
}

/**
 * Get the appropriate model for a given purpose
 * Uses remote config > env vars > defaults
 */
export function getModel(purpose?: ModelPurpose): string {
    const remoteConfig = getCachedAiConfig();
    const defaultModel = 'gpt-4o-mini';

    // Get fallback model (remote config default > env var > hardcoded default)
    const fallback = remoteConfig?.default_model || import.meta.env.VITE_AI_MODEL || defaultModel;

    if (!purpose) return fallback;

    switch (purpose) {
        case 'generate':
            return remoteConfig?.model_generate || import.meta.env.VITE_AI_MODEL_GENERATE || fallback;
        case 'fix':
            return remoteConfig?.model_fix || import.meta.env.VITE_AI_MODEL_FIX || fallback;
        case 'polish':
            return remoteConfig?.model_polish || import.meta.env.VITE_AI_MODEL_POLISH || fallback;
        case 'describe_image':
            return remoteConfig?.classifier_model || 'gpt-4o';
        default:
            return fallback;
    }
}

/**
 * Get the appropriate temperature for a given purpose
 * Uses remote config > default temperature > fallback
 */
export function getTemperature(purpose?: ModelPurpose, fallback?: number): number {
    const remoteConfig = getCachedAiConfig();
    const defaultTemperature = remoteConfig?.default_temperature;
    const baseFallback = defaultTemperature ?? fallback ?? 0.7;

    if (!purpose) return baseFallback;

    switch (purpose) {
        case 'generate':
            return remoteConfig?.temperature_generate ?? defaultTemperature ?? fallback ?? 0.9;
        case 'fix':
            return remoteConfig?.temperature_fix ?? defaultTemperature ?? fallback ?? 0.5;
        case 'polish':
            return remoteConfig?.temperature_polish ?? defaultTemperature ?? fallback ?? 0.7;
        case 'describe_image':
            return remoteConfig?.classifier_temperature ?? defaultTemperature ?? fallback ?? 1.0;
        default:
            return baseFallback;
    }
}

/**
 * Extract a short display name from a model identifier
 * e.g., "anthropic/claude-3.5-sonnet" -> "Claude 3.5 Sonnet"
 */
export function getShortModelName(model: string): string {
    const shortName = model.split('/').pop() || model;
    return shortName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace('Gpt ', 'GPT-')
        .replace('Claude ', 'Claude ')
        .replace('Gemini ', 'Gemini ')
        .trim();
}
