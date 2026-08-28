// =============================================================================
// AI Configuration Constants
// Council config, tone levels, and prompt guides
// =============================================================================

import { getCachedAiConfig, preloadAiConfig, type AiConfig } from '@/hooks/useAiConfig';
import type { CouncilConfig, CouncilGenerator, ToneLevel } from './types';

// =============================================================================
// COUNCIL CONFIGURATION
// =============================================================================

const DEFAULT_GENERATORS: CouncilGenerator[] = [{ model: 'anthropic/claude-3.5-sonnet' }];

/**
 * Get the current council configuration from remote config or environment
 */
export function getCouncilConfig(): CouncilConfig {
    const remoteConfig = getCachedAiConfig();

    if (remoteConfig) {
        // Use council_generators array if available, otherwise fall back to legacy single model
        let generators: CouncilGenerator[] = DEFAULT_GENERATORS;
        if (remoteConfig.council_generators && Array.isArray(remoteConfig.council_generators) && remoteConfig.council_generators.length > 0) {
            generators = remoteConfig.council_generators;
        } else if (remoteConfig.council_generator_model) {
            generators = [{ model: remoteConfig.council_generator_model }];
        }

        return {
            enabled: remoteConfig.council_enabled || false,
            generators,
            reviewerModel: remoteConfig.council_reviewer_model || 'google/gemini-pro-1.5',
            reviewerTemperature: remoteConfig.council_reviewer_temperature ?? 0.3,
            selectionMode: remoteConfig.council_selection_mode || 'whole_set',
        };
    }

    // Fall back to env vars
    return {
        enabled: import.meta.env.VITE_COUNCIL_ENABLED === 'true',
        generators: [{ model: import.meta.env.VITE_COUNCIL_GENERATOR_MODEL || 'anthropic/claude-3.5-sonnet' }],
        reviewerModel: import.meta.env.VITE_COUNCIL_REVIEWER_MODEL || 'google/gemini-pro-1.5',
        reviewerTemperature: 0.3,
        selectionMode: 'whole_set',
    };
}

/**
 * Initialize AI config by preloading from the standalone admin API
 * Call this on app startup to ensure config is available
 */
export async function initializeAiConfig(): Promise<AiConfig | null> {
    return preloadAiConfig();
}

// =============================================================================
// TONE LEVELS
// Controls how adventurous/extreme activities are
// =============================================================================

export const TONE_LEVELS = [
    { level: 1, label: 'Gentle', description: 'Pure emotional connection & non-sexual bonding' },
    { level: 2, label: 'Warm', description: 'Romantic atmosphere & affectionate touch' },
    { level: 3, label: 'Playful', description: 'Flirty anticipation, novelty & playful connection' },
    { level: 4, label: 'Bold', description: 'Trust, leadership & suggestive relationship dynamics' },
    { level: 5, label: 'Daring', description: 'Comfort zones, control & user-led curiosity' },
] as const;

// =============================================================================
// REVIEW GUIDELINES
// Used by council reviewer for quality assessment
// =============================================================================

export const REVIEW_GUIDELINES = `
REVIEW CRITERIA - Score each 1-10:

1. GUIDELINE COMPLIANCE:
   - Uses "your partner" (not "me", "I", "you", "him", "her")
   - Card is a proposal, not a question ("Have dinner" not "Would you want to have dinner?")
   - No wishy-washy language ("Would you...", "Have you ever...", "Do you think...")
   - No time-specific words ("tonight", "now", "today", "right now") - activities should be timeless
   - Appropriate length (5-12 words ideal)

2. CREATIVITY:
   - Not cliche (avoid: candlelit dinner, rose petals, bubble bath, Netflix and chill)
   - Specific and engaging (not generic)
   - Good variety in sentence openers

3. CLARITY:
   - Clear, actionable proposal
   - Partner text (if present) clearly describes receiver's experience
   - No confusing or ambiguous phrasing

4. CATALOGUE SAFETY:
   - REJECT named or described sexual acts, explicit anatomy, nudity for stimulation, sex toys, fetishes, BDSM acts, arousal, orgasm, or public sexual activity
   - REJECT sexual instructions disguised with euphemisms
   - ALLOW non-graphic romance, anticipation, trust, leadership, following, novelty, and user-led curiosity
   - The highest tone changes emotional boldness, never the explicitness ceiling

5. PARTNER TEXT QUALITY (if applicable):
   - Engaging and enticing, not clinical
   - Describes the reciprocal perspective without adding sexual detail
   - Preserves the same safe proposal and emotional intensity

6. COUPLE TARGETING (flag if incorrect):
   - Default: ALL couples (null)
   - Safe catalogue proposals should not require anatomical targeting
   - Flag unnecessary or exclusionary targeting

7. INITIATOR TARGETING (for asymmetric questions only):
   - Default: null (anyone can initiate)
   - Set initiator only when a legitimate non-anatomical product rule requires it
   - Flag unnecessary targeting
`;

// =============================================================================
// TONE INSTRUCTIONS
// Per-tone-level prompts for question generation
// =============================================================================

export const TONE_INSTRUCTIONS: Record<ToneLevel, string> = {
    1: 'INTIMACY LEVEL: GENTLE. Focus on emotional safety, friendship-based activities, and quality time. Examples: "Cook a new recipe together", "Take a walk holding hands", "Give non-sexual foot massages", "Watch a movie cuddling". Pure emotional connection & non-sexual bonding.',
    2: 'INTIMACY LEVEL: WARM. Focus on romantic moments, affectionate touch, and anticipation. Examples: "Slow dance in the living room", "Plan a surprise date", "Share a longer kiss", "Give your partner a relaxing massage". Romantic atmosphere without sexual instructions.',
    3: 'INTIMACY LEVEL: PLAYFUL. Focus on flirtation, novelty, private signals, playful rules, and keeping a partner guessing. Examples: "Create a private signal together", "Plan a playful surprise", "Choose a bold outfit for your partner". Suggestive relationship energy without sexual acts.',
    4: 'INTIMACY LEVEL: BOLD. Focus on trust, taking the lead, following a partner, and switching relationship dynamics. Examples: "Let your partner lead the whole date", "Set a playful rule for an evening", "Switch who makes every decision". No named fetishes, gear, sexual acts, anatomy, nudity, or arousal instructions.',
    5: 'INTIMACY LEVEL: DARING. Focus on comfort zones, control, vulnerability, and user-led curiosity. Examples: "Share something you are curious to try", "Let your partner plan a bold surprise", "Try a new dynamic together". Emotionally daring but never sexually explicit or instructional.',
};

// =============================================================================
// CORE LANGUAGE RULES
// Consolidated rules used across all generators
// =============================================================================

export const CORE_LANGUAGE_RULES = `
<language_rules>
1. ALWAYS use "your partner" - NEVER use "me", "I", "you" (as the receiver), "him", "her", or gendered pronouns
2. Cards are PROPOSALS/ACTIVITIES, NOT interview questions - "Give your partner a massage" not "Would you like to give a massage?"
3. Avoid wishy-washy language - NO "Would you...", "Have you ever...", "Do you think...", "Maybe we could..."
4. No time-specific words - NO "tonight", "now", "today", "right now" - activities should be timeless
5. Keep allowed catalogue proposals anatomy-neutral and suitable for every couple by default
6. Keep concise - ideal length is 5-12 words per question
7. UNIVERSAL SAFETY CEILING - never name or describe sexual acts, explicit anatomy, nudity for stimulation, sex toys, fetishes, BDSM acts, arousal, orgasm, or public sexual activity
8. Higher tone levels increase trust, anticipation, control, novelty, and vulnerability; they never override rule 7
</language_rules>
`;

// =============================================================================
// SYSTEM MESSAGES
// Per-tone-level system prompts for question generation
// =============================================================================

export const SYSTEM_MESSAGES: Record<ToneLevel, string> = {
    1: `You are an expert content writer for Sauci, a couples intimacy app where partners swipe on activity proposals.

<role>Generate gentle, emotionally focused activities for bonding.</role>
<constraint>NO sexual content whatsoever. Focus on emotional connection, quality time, and non-sexual touch.</constraint>
<style>Warm, caring, romantic. Activities should feel safe and nurturing.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships.</audience>`,

    2: `You are an expert content writer for Sauci, a couples intimacy app where partners swipe on activity proposals.

<role>Generate warm, romantic activities with affectionate touch.</role>
<constraint>Romantic and suggestive but not sexual or instructional. Build anticipation without naming sexual content.</constraint>
<style>Romantic, intimate, sensual. Create atmosphere and connection.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships.</audience>`,

    3: `You are an expert content writer for Sauci, a couples intimacy app where partners swipe on activity proposals.

<role>Generate playful, flirty activities about anticipation and novelty.</role>
<constraint>No sexual acts, anatomy, toys, nudity, fetishes, BDSM acts, or arousal instructions.</constraint>
<style>Playful, suggestive, and adventurous without supplying the sexual act.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships.</audience>`,

    4: `You are an expert content writer for Sauci, a couples connection app where partners swipe on activity proposals.

<role>Generate bold activities about trust, leadership, following, and switching dynamics.</role>
<constraint>No sexual acts, anatomy, toys, nudity, fetishes, BDSM acts, or arousal instructions.</constraint>
<style>Confident, suggestive, and adventurous without explicit content.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships.</audience>`,

    5: `You are an expert content writer for Sauci, a couples connection app where partners swipe on activity proposals.

<role>Generate emotionally daring activities about comfort zones, control, vulnerability, and user-led curiosity.</role>
<constraint>No sexual acts, anatomy, toys, nudity, fetishes, BDSM acts, or arousal instructions. Never turn curiosity into a developer-supplied sexual example.</constraint>
<style>Bold and intriguing while preserving the universal safety ceiling.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships seeking adventurous experiences.</audience>`,
};
