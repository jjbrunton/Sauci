// =============================================================================
// AI Configuration Constants
// Council config, tone levels, intensity levels, and prompt guides
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
            cherryPickEnsureIntensityDistribution: remoteConfig.cherry_pick_ensure_intensity_distribution ?? true,
        };
    }

    // Fall back to env vars
    return {
        enabled: import.meta.env.VITE_COUNCIL_ENABLED === 'true',
        generators: [{ model: import.meta.env.VITE_COUNCIL_GENERATOR_MODEL || 'anthropic/claude-3.5-sonnet' }],
        reviewerModel: import.meta.env.VITE_COUNCIL_REVIEWER_MODEL || 'google/gemini-pro-1.5',
        reviewerTemperature: 0.3,
        selectionMode: 'whole_set',
        cherryPickEnsureIntensityDistribution: true,
    };
}

/**
 * Initialize AI config by preloading from Supabase
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
    { level: 3, label: 'Playful', description: 'Light sexual exploration & sensual discovery' },
    { level: 4, label: 'Steamy', description: 'Explicit sexual activities & moderate adventure' },
    { level: 5, label: 'Intense', description: 'Advanced/BDSM/Extreme exploration' },
] as const;

// =============================================================================
// INTENSITY LEVELS
// For UI display - consistent with AI grading
// =============================================================================

export const INTENSITY_LEVELS = [
    { level: 1, label: 'Gentle', description: 'Pure emotional connection & non-sexual bonding', color: 'bg-green-500' },
    { level: 2, label: 'Warm', description: 'Romantic atmosphere & affectionate touch', color: 'bg-lime-500' },
    { level: 3, label: 'Playful', description: 'Light sexual exploration & sensual discovery', color: 'bg-yellow-500' },
    { level: 4, label: 'Steamy', description: 'Explicit sexual activities & moderate adventure', color: 'bg-orange-500' },
    { level: 5, label: 'Intense', description: 'Advanced/BDSM/Extreme exploration', color: 'bg-red-500' },
] as const;

// =============================================================================
// INTENSITY GRADING GUIDE
// Full version for detailed AI prompts
// =============================================================================

export const INTENSITY_GUIDE = `
INTENSITY GRADING GUIDE - Use this to assign intensity levels consistently:

Level 1 - GENTLE (Pure emotional connection & non-sexual bonding):
- Focus: Emotional safety, friendship-based activities, quality time
- Examples: Cook together, take a walk holding hands, give non-sexual foot massages, watch a movie cuddling
- Emotional bonding without sexual undertones

Level 2 - WARM (Romantic atmosphere & affectionate touch):
- Focus: Creating romantic moments, sensual but non-sexual touch, building anticipation
- Examples: Slow dance in the living room, candlelit bath together (non-sexual), extended kissing sessions, sensual massage with oils
- Romantic intimacy building up to arousal

Level 3 - PLAYFUL (Light sexual exploration & sensual discovery):
- Focus: Sexual touch without penetration, playful experimentation, building arousal
- Examples: Mutual masturbation, oral sex, light roleplay (doctor/patient), using basic toys together
- Fun and exploratory sexual contact

Level 4 - STEAMY (Explicit sexual activities & moderate adventure):
- Focus: Full sexual intercourse with adventurous elements, moderate BDSM/kink
- Examples: Sex in different locations/positions, light bondage, anal play with toys, recording consensual intimate moments
- Passionate and adventurous sexual connection

Level 5 - INTENSE (Advanced/BDSM/Extreme exploration):
- Focus: Edge play, power dynamics, intense physical experiences
- Examples: Heavy impact play, advanced bondage, consensual non-consent scenes, multi-partner activities
- Very intense, taboo kinks, and extreme exploration
`;

// =============================================================================
// INTENSITY GUIDE (SHORT)
// Condensed version for prompts to save tokens
// =============================================================================

export const INTENSITY_GUIDE_SHORT = `
INTENSITY LEVELS:
1 (Gentle): Pure emotional connection, non-sexual bonding (cooking, cuddling, foot massages)
2 (Warm): Romantic atmosphere, affectionate touch (slow dance, sensual massage, kissing)
3 (Playful): Light sexual exploration, sensual discovery (oral, mutual masturbation, light roleplay)
4 (Steamy): Explicit sexual activities, moderate adventure (sex positions, light bondage, anal play)
5 (Intense): Advanced/BDSM/Extreme exploration (impact play, power dynamics, taboo kinks)
`;

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

4. INTENSITY ACCURACY:
   Level 1 (Gentle): Pure emotional connection, non-sexual bonding
   Level 2 (Warm): Romantic atmosphere, affectionate touch
   Level 3 (Playful): Light sexual exploration, sensual discovery (oral, toys)
   Level 4 (Steamy): Explicit sexual activities, moderate adventure (intercourse, light bondage)
   Level 5 (Intense): Advanced/BDSM/Extreme exploration (impact play, power dynamics)

5. ANATOMICAL CONSISTENCY:
   - No mixed male/female anatomy in alternatives
   - BAD: "Finger or give your partner a handjob"
   - GOOD: Pick one activity

6. PARTNER TEXT QUALITY (if applicable):
   - Engaging and enticing, not clinical
   - BAD: "Receive oral from your partner"
   - GOOD: "Let your partner pleasure you with their mouth"
   - When initiator causes a response, frame as allowing: "Let your partner make you moan"

7. COUPLE TARGETING (flag if incorrect):
   - Default: ALL couples (null) unless explicit anatomical requirement
   - Restrict to ['male+male', 'female+male'] ONLY if activity requires penis
   - Restrict to ['female+male', 'female+female'] ONLY if activity requires vagina
   - Sex toys are GENDER-NEUTRAL (vibrators, dildos, plugs work for anyone)
   - Flag if targeting seems too restrictive or missing needed restrictions

8. INITIATOR TARGETING (for asymmetric questions only):
   - Default: null (anyone can initiate) unless explicit anatomical requirement
   - Set initiator based on WHO DOES the action in "text" field
   - "Swallow your partner's cum" -> initiator: female (in M+F, receiver of cum)
   - "Give your partner a massage" -> initiator: null (anyone can give)
   - Flag if initiator seems incorrectly assigned
`;

// =============================================================================
// TONE INSTRUCTIONS
// Per-tone-level prompts for question generation
// =============================================================================

export const TONE_INSTRUCTIONS: Record<ToneLevel, string> = {
    1: 'INTIMACY LEVEL: GENTLE. Focus on emotional safety, friendship-based activities, and quality time. Examples: "Cook a new recipe together", "Take a walk holding hands", "Give non-sexual foot massages", "Watch a movie cuddling". Pure emotional connection & non-sexual bonding.',
    2: 'INTIMACY LEVEL: WARM. Focus on creating romantic moments, sensual but non-sexual touch, and building anticipation. Examples: "Slow dance in the living room", "Candlelit bath together (non-sexual)", "Extended kissing sessions", "Sensual massage with oils". Romantic atmosphere & affectionate touch.',
    3: 'INTIMACY LEVEL: PLAYFUL. Focus on sexual touch without penetration, playful experimentation, and building arousal. Examples: "Mutual masturbation", "Oral sex", "Light roleplay (doctor/patient)", "Using basic toys together". Light sexual exploration & sensual discovery.',
    4: 'INTIMACY LEVEL: STEAMY. Focus on full sexual intercourse with adventurous elements and moderate BDSM/kink. Examples: "Sex in different locations/positions", "Light bondage", "Anal play with toys", "Recording consensual intimate moments". Explicit sexual activities & moderate adventure.',
    5: 'INTIMACY LEVEL: INTENSE. Focus on edge play, power dynamics, and intense physical experiences. Examples: "Heavy impact play", "Advanced bondage", "Consensual non-consent scenes", "Multi-partner activities". Advanced/BDSM/Extreme exploration.',
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
5. Maintain anatomical consistency - NEVER combine male-specific and female-specific acts as alternatives
6. Keep concise - ideal length is 5-12 words per question
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
<constraint>Sensual but NOT explicit sex. Building anticipation without crossing into explicit territory.</constraint>
<style>Romantic, intimate, sensual. Create atmosphere and connection.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships.</audience>`,

    3: `You are an expert content writer for Sauci, a couples intimacy app where partners swipe on activity proposals.

<role>Generate playful, sexually exploratory activities.</role>
<constraint>Focus on foreplay, oral, toys, and light exploration. Avoid extreme kinks.</constraint>
<style>Playful, sexy, adventurous. Encourage exploration in a fun way.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships.</audience>`,

    4: `You are an expert content writer for Sauci, an adult couples intimacy app where partners swipe on activity proposals.

<role>Generate steamy, explicit sexual activities with moderate adventure.</role>
<constraint>Full sexual content allowed including intercourse, light bondage, and moderate kinks.</constraint>
<style>Passionate, explicit, adventurous. Bold but not extreme.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships.</audience>`,

    5: `You are an expert content writer for Sauci, an adult couples intimacy app where partners swipe on activity proposals.

<role>Generate intense, advanced sexual activities including BDSM and kinks.</role>
<constraint>Edge play, power dynamics, and intense physical experiences allowed. All content is consensual adult activity.</constraint>
<style>Intense, commanding, unapologetic. Push boundaries while maintaining consent.</style>
<format>Activities are proposals users swipe on (Like/Dislike/Maybe), not interview questions. Always respond with valid JSON only.</format>
<audience>Adults aged 25-45 in committed relationships seeking adventurous experiences.</audience>`,
};
