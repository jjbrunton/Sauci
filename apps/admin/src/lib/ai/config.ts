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
            selectionMode: remoteConfig.council_selection_mode || 'whole_set',
            cherryPickEnsureIntensityDistribution: remoteConfig.cherry_pick_ensure_intensity_distribution ?? true,
        };
    }

    // Fall back to env vars
    return {
        enabled: import.meta.env.VITE_COUNCIL_ENABLED === 'true',
        generators: [{ model: import.meta.env.VITE_COUNCIL_GENERATOR_MODEL || 'anthropic/claude-3.5-sonnet' }],
        reviewerModel: import.meta.env.VITE_COUNCIL_REVIEWER_MODEL || 'google/gemini-pro-1.5',
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
    { level: 0, label: 'Everyday', description: 'Non-romantic activities - games, cooking, conversations' },
    { level: 1, label: 'Sweet', description: 'Romantic but innocent - compliments, date nights, cuddles' },
    { level: 2, label: 'Flirty', description: 'Playful teasing - flirty texts, light touching, innuendo' },
    { level: 3, label: 'Intimate', description: 'Sensual but soft - massage, making out, showering together' },
    { level: 4, label: 'Sexual', description: 'Standard sexual activities - oral, sex, toys' },
    { level: 5, label: 'Wild', description: 'Extreme/kinky - public sex, creampies, BDSM, exhibitionism' },
] as const;

// =============================================================================
// INTENSITY LEVELS
// For UI display - consistent with AI grading
// =============================================================================

export const INTENSITY_LEVELS = [
    { level: 1, label: 'Light', description: 'Talking, emotional sharing, compliments, non-sexual', color: 'bg-green-500' },
    { level: 2, label: 'Mild', description: 'Hugging, cuddling, gentle kisses, flirty texts', color: 'bg-lime-500' },
    { level: 3, label: 'Moderate', description: 'Making out, massage, sexy/suggestive photos', color: 'bg-yellow-500' },
    { level: 4, label: 'Spicy', description: 'Oral, foreplay, nudes, explicit sexting', color: 'bg-orange-500' },
    { level: 5, label: 'Intense', description: 'Sex, kinks, BDSM, explicit videos', color: 'bg-red-500' },
] as const;

// =============================================================================
// INTENSITY GRADING GUIDE
// Full version for detailed AI prompts
// =============================================================================

export const INTENSITY_GUIDE = `
INTENSITY GRADING GUIDE - Use this to assign intensity levels consistently:

Level 1 - LIGHT (Emotional/Non-Sexual):
- Talking, sharing feelings, compliments, emotional vulnerability
- Non-physical activities: writing letters, planning dates, sharing dreams
- Clean activities with no sexual undertones
- Examples: "Share your biggest dream", "Write a love note", "Plan a surprise date"

Level 2 - MILD (Affectionate/Flirty):
- Light physical affection: holding hands, hugging, cuddling
- Gentle kisses, playing with hair, light touches
- Flirty but non-sexual: dancing together, sleeping in each other's arms
- Examples: "Give your partner a forehead kiss", "Cuddle while watching a movie", "Send a flirty text"

Level 3 - MODERATE (Sensual/Suggestive):
- Making out, passionate kissing, intimate massage
- Sensual touch over clothes, caressing, teasing
- Suggestive photos (lingerie, shirtless), sexy selfies, teasing texts
- Showering together, skinny dipping
- Examples: "Give a sensual massage", "Send a sexy photo", "Make out somewhere risky"

Level 4 - SPICY (Sexual/Explicit Content):
- Oral sex, fingering, handjobs, mutual masturbation
- Foreplay activities, using hands/mouth on private parts
- Nudes, explicit photos, dirty pics, sexting explicit content
- Using toys externally, edging, making your partner cum
- Examples: "Go down on your partner", "Send a nude", "Sext each other something filthy"

Level 5 - INTENSE (Penetration/Advanced Kinks):
- Sex (vaginal or anal), toys inside, fingers inside
- Kinks: bondage, role-play with power dynamics, BDSM
- Threesomes, exhibitionism, voyeurism
- Making/sharing explicit videos, masturbating on video call
- Examples: "Fuck in a new location", "Try anal", "Record yourselves having sex"

IMPORTANT: Intensity is about SEXUAL CONTENT level, not just physical touch.
Sending nudes = Level 4, Sexting explicit content = Level 4, Dirty/filthy photos = Level 4.
`;

// =============================================================================
// INTENSITY GUIDE (SHORT)
// Condensed version for prompts to save tokens
// =============================================================================

export const INTENSITY_GUIDE_SHORT = `
INTENSITY LEVELS:
1 (Light): Talking, emotional sharing, compliments, non-sexual activities
2 (Mild): Holding hands, hugging, cuddling, gentle kisses, flirty texts
3 (Moderate): Making out, sensual massage, sexy/suggestive photos, teasing
4 (Spicy): Oral sex, fingering, handjobs, nudes, explicit photos/sexting, foreplay
5 (Intense): Sex, anal, kinks, BDSM, explicit videos, threesomes

IMPORTANT: "Filthy photo", "nude", "dirty pic" = Level 4. "Sexy photo", "lingerie pic" = Level 3.
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
   Level 1 (Light): Talking, emotional sharing, compliments, non-sexual
   Level 2 (Mild): Holding hands, hugging, cuddling, gentle kisses, flirty texts
   Level 3 (Moderate): Making out, sensual massage, sexy/suggestive photos, teasing
   Level 4 (Spicy): Oral sex, fingering, handjobs, nudes, explicit photos/sexting
   Level 5 (Intense): Sex, anal, kinks, BDSM, explicit videos, threesomes

5. ANATOMICAL CONSISTENCY:
   - No mixed male/female anatomy in alternatives
   - BAD: "Finger or give your partner a handjob"
   - GOOD: Pick one activity

6. PARTNER TEXT QUALITY (if applicable):
   - Engaging and enticing, not clinical
   - BAD: "Receive oral from your partner"
   - GOOD: "Let your partner pleasure you with their mouth"
   - When initiator causes a response, frame as allowing: "Let your partner make you moan"
`;

// =============================================================================
// TONE INSTRUCTIONS
// Per-tone-level prompts for question generation
// =============================================================================

export const TONE_INSTRUCTIONS: Record<ToneLevel, string> = {
    0: 'WILDNESS LEVEL: EVERYDAY. Generate non-romantic activities only. Focus on communication, teamwork, fun, personal growth, and bonding WITHOUT any romantic or sexual undertones. Examples: "Cook a new recipe together", "Play a board game", "Send your partner a compliment while they\'re at work", "Plan a weekend adventure". NO flirting, NO romance, NO intimacy.',
    1: 'WILDNESS LEVEL: SWEET. Generate romantic but innocent activities. Focus on emotional connection, love, and tenderness. Examples: "Write your partner a love letter", "Plan a surprise date night", "Cuddle and watch the sunset", "Give your partner a back massage". NO sexual content.',
    2: 'WILDNESS LEVEL: FLIRTY. Generate playful, teasing activities with light innuendo. Examples: "Send a flirty text during the day", "Whisper something suggestive in your partner\'s ear", "Give your partner a lingering kiss goodbye". Suggestive but NOT explicitly sexual.',
    3: 'WILDNESS LEVEL: INTIMATE. Generate sensual activities that imply intimacy without being graphic. Examples: "Give your partner a full-body massage", "Shower together", "Make out somewhere unexpected", "Sleep naked together". Passionate but soft - no explicit sex acts.',
    4: 'WILDNESS LEVEL: SEXUAL. Generate standard sexual activities. Examples: "Go down on your partner", "Have sex in a new position", "Use a vibrator together", "Wake your partner up with oral". Direct language, avoid clinical terms. This is vanilla sex - adventurous but not extreme.',
    5: 'WILDNESS LEVEL: WILD. Generate extreme, kinky, or taboo activities. Think: public sex, exhibitionism, BDSM, risky situations, intense kinks. Examples: "Get creampied by your partner and go to dinner", "Have sex somewhere you might get caught", "Let your partner tie you up and use you", "Edge each other for an hour before allowing release". Push boundaries. Use crude terms when they ARE the activity (cum, cock ring) but tasteful phrasing for general acts (have sex, not fuck). NEVER sanitize "cum" to "come".',
};

// =============================================================================
// SYSTEM MESSAGES
// Per-tone-level system prompts for question generation
// =============================================================================

export const SYSTEM_MESSAGES: Record<ToneLevel, string> = {
    0: 'You are a content writer for a couples app. Generate everyday activities focused on bonding, communication, and fun. No romance or intimacy. Always respond with valid JSON only.',
    1: 'You are a content writer for a couples app. Generate sweet, romantic activities that help couples connect emotionally. Keep it innocent and wholesome. Always respond with valid JSON only.',
    2: 'You are a content writer for a couples app. Generate flirty, playful activities with light teasing and innuendo. Suggestive but not sexual. Always respond with valid JSON only.',
    3: 'You are a content writer for a couples app. Generate intimate, sensual activities that imply passion without being explicit. Always respond with valid JSON only.',
    4: 'You are a content writer for an adult couples app. Generate sexual activities with direct, natural language. Write like a sex-positive friend - not clinical. Always respond with valid JSON only.',
    5: 'You are a content writer for an adult couples app. Generate wild, extreme, kinky activities that push boundaries. Use crude terms when they ARE the act but tasteful phrasing for general sex/oral. Never use clinical terms. Always respond with valid JSON only.',
};
