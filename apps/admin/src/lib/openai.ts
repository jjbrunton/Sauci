import OpenAI from 'openai';
import { getCachedAiConfig, preloadAiConfig, type AiConfig } from '@/hooks/useAiConfig';

// Note: In production, this should be called from a backend/edge function
// to avoid exposing the API key

// Cache for the OpenAI instance to avoid recreating on every call
let cachedOpenAI: OpenAI | null = null;
let cachedApiKey: string | null = null;

const getOpenAI = () => {
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
};

type ModelPurpose = 'generate' | 'fix' | 'polish';

const getModel = (purpose?: ModelPurpose) => {
    // First, try to get model from remote config
    const remoteConfig = getCachedAiConfig();

    // Granular model selection by purpose
    // Priority: remote config > env vars > default
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
        default:
            return fallback;
    }
};

// =============================================================================
// COUNCIL CONFIGURATION - Multi-model review system
// =============================================================================

export interface CouncilGenerator {
    model: string;
}

export interface CouncilConfig {
    enabled: boolean;
    generators: CouncilGenerator[];
    reviewerModel: string;
}

const DEFAULT_GENERATORS: CouncilGenerator[] = [{ model: 'anthropic/claude-3.5-sonnet' }];

export function getCouncilConfig(): CouncilConfig {
    // First, try to get config from remote
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
        };
    }

    // Fall back to env vars
    return {
        enabled: import.meta.env.VITE_COUNCIL_ENABLED === 'true',
        generators: [{ model: import.meta.env.VITE_COUNCIL_GENERATOR_MODEL || 'anthropic/claude-3.5-sonnet' }],
        reviewerModel: import.meta.env.VITE_COUNCIL_REVIEWER_MODEL || 'google/gemini-pro-1.5',
    };
}

/**
 * Initialize AI config by preloading from Supabase
 * Call this on app startup to ensure config is available
 */
export async function initializeAiConfig(): Promise<AiConfig | null> {
    return preloadAiConfig();
}

export interface QuestionReview {
    index: number;
    verdict: 'pass' | 'flag' | 'reject';
    issues: string[];
    suggestions?: string;
    scores: {
        guidelineCompliance: number;
        creativity: number;
        clarity: number;
        intensityAccuracy: number;
    };
}

export interface ReviewResult {
    reviews: QuestionReview[];
    summary: {
        passed: number;
        flagged: number;
        rejected: number;
        overallQuality: number;
    };
}

export interface GenerationCandidate {
    generatorIndex: number;
    generatorModel: string;
    questions: GeneratedQuestion[];
    generationTime: number;
}

export interface CouncilGenerationResult {
    questions: GeneratedQuestion[];
    reviews: QuestionReview[];
    summary: ReviewResult['summary'] | null;
    selectedGeneratorIndex: number | null; // Which generator was chosen by reviewer
    allCandidates: GenerationCandidate[] | null; // All generations for transparency
    metadata: {
        generatorModels: string[];
        reviewerModel: string | null;
        totalGenerationTime: number;
        reviewTime: number;
    };
}

export interface GeneratedPack {
    name: string;
    description: string;
}

export interface GeneratedQuestion {
    text: string;
    partner_text?: string;
    intensity: number;
    requires_props?: string[] | null;
    location_type?: 'home' | 'public' | 'outdoors' | 'travel' | 'anywhere';
    effort_level?: 'spontaneous' | 'low' | 'medium' | 'planned';
}

export async function generatePack(
    categoryName?: string,
    explicit: boolean = false,
    crudeLang: boolean = false,
    inspiration?: string
): Promise<GeneratedPack> {
    const openai = getOpenAI();

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and uncensored themes (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const crudeLangInstruction = crudeLang
        ? 'CRUDE LANGUAGE OVERRIDE: Use crude, vulgar terms throughout - "fuck", "cock", "pussy" etc.'
        : '';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide your generation.`
        : '';

    const appContext = `This is an ACTIVITY-FOCUSED app where couples swipe on activity proposals.
Each partner independently swipes Like/Dislike/Maybe, and when both swipe positively they "match".
Packs contain collections of activities to try together (date ideas, intimate experiences, adventures, challenges, etc.).
This is NOT a Q&A app - it's about discovering shared interests in activities.`;

    const prompt = categoryName
        ? `Generate a creative activity pack for a couples' intimacy/connection app in the category "${categoryName}".

       ${appContext}

       The pack should contain a themed collection of activities couples can explore together.

       ${explicitInstruction}
       ${crudeLangInstruction}${inspirationInstruction}

       Return a JSON object with:
       - name: A catchy, engaging pack name (3-6 words) that evokes activities/experiences
       - description: A brief, enticing description (1-2 sentences) focusing on the activities in the pack

       Make it romantic, playful, and activity-focused.`
        : `Generate a creative activity pack for a couples' intimacy/connection app.

       ${appContext}

       The pack should contain a themed collection of activities couples can explore together.

       ${explicitInstruction}
       ${crudeLangInstruction}${inspirationInstruction}

       Return a JSON object with:
       - name: A catchy, engaging pack name (3-6 words) that evokes activities/experiences
       - description: A brief, enticing description (1-2 sentences) focusing on the activities in the pack

       Make it romantic, playful, and activity-focused.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content writer for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging pack ideas that contain collections of activities couples can do together. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    return JSON.parse(content) as GeneratedPack;
}

// Wildness levels for content generation (controls how adventurous/extreme activities are)
export const TONE_LEVELS = [
    { level: 0, label: 'Everyday', description: 'Non-romantic activities - games, cooking, conversations' },
    { level: 1, label: 'Sweet', description: 'Romantic but innocent - compliments, date nights, cuddles' },
    { level: 2, label: 'Flirty', description: 'Playful teasing - flirty texts, light touching, innuendo' },
    { level: 3, label: 'Intimate', description: 'Sensual but soft - massage, making out, showering together' },
    { level: 4, label: 'Sexual', description: 'Standard sexual activities - oral, sex, toys' },
    { level: 5, label: 'Wild', description: 'Extreme/kinky - public sex, creampies, BDSM, exhibitionism' },
] as const;

export type ToneLevel = 0 | 1 | 2 | 3 | 4 | 5;

// Intensity levels for questions (controls sexual/intimacy level)
// This guide helps AI consistently grade question intensity
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

// Condensed version for prompts (to save tokens)
export const INTENSITY_GUIDE_SHORT = `
INTENSITY LEVELS:
1 (Light): Talking, emotional sharing, compliments, non-sexual activities
2 (Mild): Holding hands, hugging, cuddling, gentle kisses, flirty texts
3 (Moderate): Making out, sensual massage, sexy/suggestive photos, teasing
4 (Spicy): Oral sex, fingering, handjobs, nudes, explicit photos/sexting, foreplay
5 (Intense): Sex, anal, kinks, BDSM, explicit videos, threesomes

IMPORTANT: "Filthy photo", "nude", "dirty pic" = Level 4. "Sexy photo", "lingerie pic" = Level 3.
`;

// Intensity levels for UI display (consistent with AI grading)
export const INTENSITY_LEVELS = [
    { level: 1, label: 'Light', description: 'Talking, emotional sharing, compliments, non-sexual', color: 'bg-green-500' },
    { level: 2, label: 'Mild', description: 'Hugging, cuddling, gentle kisses, flirty texts', color: 'bg-lime-500' },
    { level: 3, label: 'Moderate', description: 'Making out, massage, sexy/suggestive photos', color: 'bg-yellow-500' },
    { level: 4, label: 'Spicy', description: 'Oral, foreplay, nudes, explicit sexting', color: 'bg-orange-500' },
    { level: 5, label: 'Intense', description: 'Sex, kinks, BDSM, explicit videos', color: 'bg-red-500' },
] as const;

export async function generateQuestions(
    packName: string,
    count: number = 10,
    intensity?: number,
    tone: ToneLevel = 3,
    packDescription?: string,
    existingQuestions?: string[],
    crudeLang: boolean = false,
    inspiration?: string
): Promise<GeneratedQuestion[]> {
    const openai = getOpenAI();
    const isClean = tone === 0;
    const isExplicit = tone >= 4;

    const crudeLangInstruction = crudeLang
        ? '\n\nCRUDE LANGUAGE OVERRIDE: Ignore nuanced language rules. Use crude, vulgar terms throughout - "fuck" instead of "have sex", "suck cock" instead of "perform oral", etc. Be raw and direct like uncensored sexting.'
        : ''; // Let the wildness level instructions handle language style

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide the types of questions you generate.`
        : '';

    const intensityInstruction = isClean
        ? 'All questions should be intensity level 1 (non-physical activities).'
        : intensity
            ? `All questions should be at intensity level ${intensity}.`
            : 'Vary the intensity levels from 1 to 5 across the questions for good variety.';

    const toneInstructions: Record<ToneLevel, string> = {
        0: 'WILDNESS LEVEL: EVERYDAY. Generate non-romantic activities only. Focus on communication, teamwork, fun, personal growth, and bonding WITHOUT any romantic or sexual undertones. Examples: "Cook a new recipe together", "Play a board game", "Send your partner a compliment while they\'re at work", "Plan a weekend adventure". NO flirting, NO romance, NO intimacy.',
        1: 'WILDNESS LEVEL: SWEET. Generate romantic but innocent activities. Focus on emotional connection, love, and tenderness. Examples: "Write your partner a love letter", "Plan a surprise date night", "Cuddle and watch the sunset", "Give your partner a back massage". NO sexual content.',
        2: 'WILDNESS LEVEL: FLIRTY. Generate playful, teasing activities with light innuendo. Examples: "Send a flirty text during the day", "Whisper something suggestive in your partner\'s ear", "Give your partner a lingering kiss goodbye". Suggestive but NOT explicitly sexual.',
        3: 'WILDNESS LEVEL: INTIMATE. Generate sensual activities that imply intimacy without being graphic. Examples: "Give your partner a full-body massage", "Shower together", "Make out somewhere unexpected", "Sleep naked together". Passionate but soft - no explicit sex acts.',
        4: 'WILDNESS LEVEL: SEXUAL. Generate standard sexual activities. Examples: "Go down on your partner", "Have sex in a new position", "Use a vibrator together", "Wake your partner up with oral". Direct language, avoid clinical terms. This is vanilla sex - adventurous but not extreme.',
        5: 'WILDNESS LEVEL: WILD. Generate extreme, kinky, or taboo activities. Think: public sex, exhibitionism, BDSM, risky situations, intense kinks. Examples: "Get creampied by your partner and go to dinner", "Have sex somewhere you might get caught", "Let your partner tie you up and use you", "Edge each other for an hour before allowing release". Push boundaries. Use crude terms when they ARE the activity (cum, cock ring) but tasteful phrasing for general acts (have sex, not fuck). NEVER sanitize "cum" to "come".',
    };

    const toneInstruction = toneInstructions[tone];

    // Use different examples based on tone level
    const symmetricExamples = isClean
        ? 'GOOD: "Cook a new recipe together", "Play a board game", "Go on a hike", "Have a deep conversation about your goals".'
        : isExplicit
            ? 'GOOD: "Fuck in a risky place", "Try a new position", "Sixty-nine together", "Watch porn and recreate a scene".'
            : 'GOOD: "Cook a romantic dinner together", "Stargaze and share dreams", "Give each other massages", "Dance together at home".';

    const asymmetricExamples = isClean
        ? `Examples:
   - text: "Cook your partner their favorite meal" → partner_text: "Have your partner cook your favorite meal"
   - text: "Plan a surprise for your partner" → partner_text: "Be surprised by your partner"
   - text: "Give your partner a compliment" → partner_text: "Receive a compliment from your partner"`
        : isExplicit
            ? `Examples:
   - text: "Go down on your partner" → partner_text: "Have your partner go down on you"
   - text: "Send your partner a nude" → partner_text: "Receive a nude from your partner"
   - text: "Tie your partner up" → partner_text: "Get tied up by your partner"
   - text: "Spank your partner" → partner_text: "Get spanked by your partner"`
            : `Examples:
   - text: "Give your partner a massage" → partner_text: "Receive a massage from your partner"
   - text: "Write your partner a love letter" → partner_text: "Receive a love letter from your partner"
   - text: "Plan a surprise date for your partner" → partner_text: "Be surprised with a date by your partner"`;

    const explicitWarning = isClean
        ? '\n\nCRITICAL: This is a CLEAN pack with NO romantic or sexual content. Focus ONLY on communication, activities, challenges, and bonding. NO romance, NO flirting, NO intimacy, NO physical affection beyond friendly gestures.'
        : isExplicit
            ? ''
            : '\n\nCRITICAL: This is a NON-EXPLICIT pack. Do NOT include any sexual acts, crude language, or NSFW content. Keep all proposals romantic, playful, or emotionally intimate without being sexually explicit.';

    const descriptionContext = packDescription
        ? `\nPack Description: "${packDescription}"\nUse this description to guide the theme and style of questions.`
        : '';

    const existingQuestionsContext = existingQuestions && existingQuestions.length > 0
        ? `\n\nEXISTING QUESTIONS IN THIS PACK (DO NOT DUPLICATE OR CREATE SIMILAR VARIATIONS):
${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

CRITICAL: Generate completely NEW and DIFFERENT questions. Do not repeat any of the above questions or create minor variations of them. Each new question must offer a genuinely distinct activity or experience.`
        : '';

    const prompt = `Generate ${count} unique questions for a couples' intimacy question pack called "${packName}".${descriptionContext}${existingQuestionsContext}

${INTENSITY_GUIDE_SHORT}

${intensityInstruction}
${toneInstruction}${explicitWarning}${crudeLangInstruction}${inspirationInstruction}

IMPORTANT: The app uses a swipe-based interface (Like/Dislike/Maybe).
Cards should be "Proposals" for specific actions, NOT interview questions.

CRITICAL LANGUAGE RULES:
- ALWAYS use "your partner" - NEVER use "me", "I", "you" (as the receiver), "him", "her"
- BAD: "Send me a photo" (who is "me"?), "Let me spank you", "I want you to..."
- GOOD: "Send your partner a photo", "Spank your partner", "Give your partner..."
- The card reader is the DOER. Their partner is "your partner".

ANATOMICAL CONSISTENCY RULE:
- NEVER combine male-specific and female-specific acts as alternatives in the same question.
- A partner has ONE set of anatomy - don't offer "or" alternatives that require different anatomy.
- BAD: "Finger or give your partner a handjob" (fingering = vagina, handjob = penis)
- BAD: "Suck their cock or eat them out" (cock = male, eating out = female)
- GOOD: "Give your partner a handjob" (single activity for target anatomy)
- GOOD: "Go down on your partner" (gender-neutral oral phrasing)

TIMELESS LANGUAGE RULE:
- NEVER use time-specific words like "tonight", "now", "today", "this evening", "right now"
- Activities are proposals that couples may do at ANY time in the future
- BAD: "Give your partner a massage tonight", "Text your partner right now"
- GOOD: "Give your partner a massage", "Send your partner a flirty text"

For each question, decide if it is SYMMETRIC (shared) or ASYMMETRIC (one does to the other):

1. SYMMETRIC Activities (partner_text = null):
   - Both partners do the same thing together.
   - ${symmetricExamples}
   - BAD: "Have you ever thought about...", "Do you think we should..."

2. ASYMMETRIC Actions (requires partner_text):
   - One partner does something TO/FOR the other, or roles differ.
   - text = what the INITIATOR does (their action/perspective)
   - partner_text = what the RECEIVER does/experiences (their action/perspective)
   - ${asymmetricExamples}
   - BOTH texts must use "your partner" - never "me" or "I"
   - IMPORTANT: partner_text should describe the RECEIVER's experience clearly:
     - text: "Send your partner to the bathroom and follow a minute later"
     - partner_text: "Go to the bathroom and wait for your partner to join you" (clear receiver instructions)
     - NOT: "Wait for your partner to follow you" (confusing/wrong)
   - When initiator CAUSES a response (moan, cum, beg, etc.), partner_text should frame as ALLOWING/RECEIVING, not performing:
     - text: "Make your partner moan in public" → partner_text: "Let your partner make you moan in public"
     - text: "Edge your partner until they beg" → partner_text: "Let your partner edge you until you beg"
     - NOT: "Moan for your partner in public" (sounds like deliberate performance, not natural response)

Required JSON structure:
- text: The proposal (DOER's perspective, uses "your partner")
- partner_text: For asymmetric only - RECEIVER's perspective (also uses "your partner")
- intensity: 1-5 based on INTENSITY LEVELS above.
- requires_props: (optional) Array of items needed, e.g., ["blindfold", "ice"], or null if nothing special needed
- location_type: (optional) "home" | "public" | "outdoors" | "travel" | "anywhere"
- effort_level: (optional) "spontaneous" | "low" | "medium" | "planned"

SENTENCE VARIETY - Vary your sentence openers. Do NOT start every question the same way:
- GOOD variety: "Give your partner...", "Surprise your partner with...", "Try...", "Explore...", "Whisper...", "Tease your partner by...", "Wake your partner up with...", "Send your partner..."
- BAD: Starting 5 questions with "Give your partner..."

AVOID CLICHÉS - These are overused and boring:
- "Candlelit dinner", "rose petals", "bubble bath together", "Netflix and chill", "breakfast in bed" (unless the pack specifically calls for classics)
- Generic romance movie tropes - be more creative and specific

LENGTH GUIDELINES:
- Aim for 5-12 words per question
- Too short (<4 words): "Kiss passionately" - lacks context
- Too long (>15 words): Feels like instructions, not a proposal
- Sweet spot: "Blindfold your partner and feed them mystery foods"

SEMANTIC UNIQUENESS - Avoid generating questions that are essentially the same activity:
- BAD: "Give your partner oral" AND "Go down on your partner" (same thing)
- BAD: "Have sex in the shower" AND "Make love in the shower" (same thing)
- Each question should be a genuinely DIFFERENT activity

ACTIVITY DIVERSITY - Within a batch, ensure variety:
- Mix activity TYPES: Don't generate 5 oral questions in a row
- Mix LOCATIONS: Home, public, outdoors, travel, car, etc.
- Mix EFFORT LEVELS: Quick/spontaneous AND planned/elaborate
- Mix WHO GIVES/RECEIVES: Balance of initiator-focused and receiver-focused activities

PACK COHESION - Questions should fit the pack theme:
- If pack is "Public Adventures", don't include "Cuddle in bed"
- If pack is "Gentle Romance", don't include intense BDSM
- Stay true to the pack name and description

RELATIONSHIP CONTEXT - Don't assume:
- Not all couples live together (avoid "when you wake up together" unless appropriate)
- Not all couples have been intimate before (context-dependent)
- Some activities need privacy others don't have (roommates, kids)

BDSM/KINK SAFETY - For bondage, power play, or edge play content:
- Include implicit consent framing where appropriate: "If you're both comfortable...", "With your partner's enthusiastic consent..."
- For restraint activities, the receiver's card should emphasize their agency: "Let your partner restrain you" not "Be restrained"
- Avoid activities that could cause harm without proper knowledge (breath play, suspension, etc.) unless the pack is specifically for experienced practitioners

PARTNER_TEXT APPEAL - Make the receiver's version equally enticing:
- BAD: text: "Give your partner a sensual massage" → partner_text: "Receive a massage from your partner" (boring, clinical)
- GOOD: text: "Give your partner a sensual massage" → partner_text: "Let your partner's hands explore and relax your body"
- The receiver should feel excited reading their card, not like they're just an object

=== FEW-SHOT EXAMPLES ===
Study these examples carefully. They demonstrate the quality, style, and format expected:

SYMMETRIC EXAMPLES (partner_text = null, both do the same thing):
{
  "text": "Skinny dip together somewhere secluded",
  "partner_text": null,
  "intensity": 3,
  "location_type": "outdoors",
  "effort_level": "planned"
}
{
  "text": "Have sex in a place you might get caught",
  "partner_text": null,
  "intensity": 5,
  "location_type": "public",
  "effort_level": "spontaneous"
}
{
  "text": "Cook a meal together wearing only aprons",
  "partner_text": null,
  "intensity": 3,
  "location_type": "home",
  "effort_level": "low"
}
{
  "text": "Share your deepest fantasy with each other",
  "partner_text": null,
  "intensity": 2,
  "location_type": "anywhere",
  "effort_level": "spontaneous"
}

ASYMMETRIC EXAMPLES (different roles, needs partner_text):
{
  "text": "Blindfold your partner and tease them with ice",
  "partner_text": "Let your partner blindfold you and tease your senses with ice",
  "intensity": 4,
  "requires_props": ["blindfold", "ice"],
  "location_type": "home",
  "effort_level": "low"
}
{
  "text": "Wake your partner up with oral",
  "partner_text": "Let your partner wake you up with their mouth on you",
  "intensity": 4,
  "location_type": "home",
  "effort_level": "spontaneous"
}
{
  "text": "Tie your partner's hands and have your way with them",
  "partner_text": "Let your partner tie your hands and surrender control",
  "intensity": 5,
  "requires_props": ["restraints"],
  "location_type": "home",
  "effort_level": "low"
}
{
  "text": "Write a dirty note and hide it for your partner to find",
  "partner_text": "Discover a dirty note your partner hid for you",
  "intensity": 2,
  "location_type": "anywhere",
  "effort_level": "low"
}
{
  "text": "Send your partner to the bathroom and follow a minute later",
  "partner_text": "Go to the bathroom and wait for your partner to join you",
  "intensity": 4,
  "location_type": "public",
  "effort_level": "spontaneous"
}
{
  "text": "Edge your partner until they beg to cum",
  "partner_text": "Let your partner edge you until you're begging for release",
  "intensity": 5,
  "location_type": "home",
  "effort_level": "medium"
}

BAD EXAMPLES (DO NOT generate like these):
❌ { "text": "Would you want to try a massage?", ... } // Wishy-washy question
❌ { "text": "Give your partner oral", "partner_text": "Receive oral from your partner", ... } // Boring partner_text
❌ { "text": "Candlelit dinner with rose petals", ... } // Cliché
❌ { "text": "Moan for your partner in public", ... } // Sounds like performance, not natural
❌ { "text": "Finger or give your partner a handjob", ... } // Mixed anatomy
❌ { "text": "Make love", ... } // Too vague, lacks context
❌ { "text": "Take your partner to a romantic restaurant and order wine and have a lovely conversation about your future together", ... } // Way too long

=== END EXAMPLES ===

Return a JSON object with a "questions" array.
Mix symmetric and asymmetric proposals. Vary sentence openers. Be creative and specific.`;

    const systemMessages: Record<ToneLevel, string> = {
        0: 'You are a content writer for a couples app. Generate everyday activities focused on bonding, communication, and fun. No romance or intimacy. Always respond with valid JSON only.',
        1: 'You are a content writer for a couples app. Generate sweet, romantic activities that help couples connect emotionally. Keep it innocent and wholesome. Always respond with valid JSON only.',
        2: 'You are a content writer for a couples app. Generate flirty, playful activities with light teasing and innuendo. Suggestive but not sexual. Always respond with valid JSON only.',
        3: 'You are a content writer for a couples app. Generate intimate, sensual activities that imply passion without being explicit. Always respond with valid JSON only.',
        4: 'You are a content writer for an adult couples app. Generate sexual activities with direct, natural language. Write like a sex-positive friend - not clinical. Always respond with valid JSON only.',
        5: 'You are a content writer for an adult couples app. Generate wild, extreme, kinky activities that push boundaries. Use crude terms when they ARE the act (cum, cock ring) but tasteful phrasing for general sex/oral. Never use clinical terms. Always respond with valid JSON only.',
    };

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: systemMessages[tone],
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.questions as GeneratedQuestion[];
}

export async function generateCategory(): Promise<{ name: string; description: string; icon: string }> {
    const openai = getOpenAI();
    const prompt = `Generate a unique category for organizing activity packs in a couples' intimacy/connection app.

This is an ACTIVITY-FOCUSED app where couples swipe on activity proposals.
Each partner independently swipes Like/Dislike/Maybe, and when both swipe positively they "match".
Categories organize collections of activity packs (date ideas, intimate experiences, adventures, challenges, etc.).
This is NOT a Q&A app - it's about discovering shared interests in activities.

Return a JSON object with:
- name: Category name (1-3 words, e.g., "Romance", "Adventure", "Date Nights")
- description: Brief description of what activity packs in this category contain (1 sentence)
- icon: A single emoji that represents this category

Be creative and think of categories that help couples explore different types of activities together.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content organizer for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging category ideas for organizing activity packs. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    return JSON.parse(content);
}

export interface GeneratedCategoryIdea {
    name: string;
    description: string;
    icon: string;
}

export async function suggestCategories(
    existingCategories: string[],
    explicit: boolean,
    crudeLang: boolean = false,
    inspiration?: string
): Promise<GeneratedCategoryIdea[]> {
    const openai = getOpenAI();
    const existingList = existingCategories.length > 0
        ? existingCategories.join(', ')
        : 'None';

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and explicitly intimate categories (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const crudeLangInstruction = crudeLang
        ? '\nCRUDE LANGUAGE OVERRIDE: Use crude, vulgar terms in the names and descriptions.'
        : '';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide your category suggestions.`
        : '';

    const prompt = `Here are the current categories in our couples' activity/intimacy app: ${existingList}.

IMPORTANT - HOW THE APP WORKS:
- This is an ACTIVITY-FOCUSED app where couples swipe on activity proposals
- Each partner independently swipes Like/Dislike/Maybe on activities
- When BOTH partners swipe positively, they "match" and can discuss the activity
- Categories organize collections of activity packs (date ideas, intimate experiences, adventures, etc.)
- This is NOT a Q&A app - it's about discovering shared interests in activities to do together

Suggest 5 NEW, UNIQUE category ideas that differ from the existing ones.
${explicitInstruction}${crudeLangInstruction}${inspirationInstruction}

Return a JSON object with an "ideas" array containing 5 objects, where each object has:
- name: Category name (1-3 words)
- description: Brief description of what activity packs in this category contain (1 sentence)
- icon: A single descriptive emoji

Focus on diverse activity themes like: date ideas, adventures, intimate experiences, bonding activities, challenges, travel, home activities, etc.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content strategist for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging, diverse category ideas for organizing activity packs. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.ideas as GeneratedCategoryIdea[];
}
export interface GeneratedPackIdea {
    name: string;
    description: string;
    icon: string;
}

export async function suggestPacks(
    categoryName: string,
    existingPacks: string[],
    explicit: boolean,
    crudeLang: boolean = false,
    inspiration?: string
): Promise<GeneratedPackIdea[]> {
    const openai = getOpenAI();
    const existingList = existingPacks.length > 0
        ? existingPacks.join(', ')
        : 'None';

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and uncensored pack ideas (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const crudeLangInstruction = crudeLang
        ? '\nCRUDE LANGUAGE OVERRIDE: Use crude, vulgar terms in the pack names and descriptions.'
        : '';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide your pack suggestions.`
        : '';

    const prompt = `We are building activity packs for the category "${categoryName}" in a couples' intimacy app.

IMPORTANT - HOW THE APP WORKS:
- This is an ACTIVITY-FOCUSED app, NOT a Q&A app
- Packs contain ACTIVITY PROPOSALS (things couples can do together)
- Each partner independently swipes Like/Dislike/Maybe on activities
- When BOTH partners swipe positively on the same activity, they "match" and can discuss it
- Activities are things like: date ideas, intimate experiences, adventures, challenges, conversations to have, etc.
- This is NOT about asking each other questions - it's about discovering shared interests in activities

PACK THEMES should focus on:
- Collections of related activities couples might want to try
- Experiences to share together
- Things to do, not questions to ask
- Date ideas, adventures, intimate moments, challenges, bonding activities

Existing packs in this category: ${existingList}.

Suggest 5 NEW, UNIQUE pack ideas that fit this category and differ from existing ones.
${explicitInstruction}${crudeLangInstruction}${inspirationInstruction}

Return a JSON object with an "ideas" array containing 5 objects, where each object has:
- name: Pack name (catchy, 3-6 words) - should evoke activities/experiences, not questions
- description: Brief description (1-2 sentences) focusing on the activities/experiences in the pack
- icon: A single descriptive emoji

Make them engaging and specific to "${categoryName}".`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content strategist for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging pack ideas that contain collections of activities couples can do together. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.ideas as GeneratedPackIdea[];
}

export async function polishContent(
    text: string,
    type: 'question' | 'partner_text' | 'pack_name' | 'pack_description' | 'category_name',
    explicit: boolean = false
): Promise<string> {
    const openai = getOpenAI();

    const explicitInstruction = explicit
        ? 'Use nuanced language: tasteful phrasing for general acts ("have sex", "perform oral") but crude/specific terms when relevant to the activity ("cum on", "cock ring", "edge"). Do not over-sanitize - keep explicit terms that are essential to the activity. NEVER change "cum" to "come" - they have different meanings.'
        : 'CRITICAL: This is a NON-EXPLICIT pack. Keep it clean, romantic, and playful. Do NOT add any sexual acts, crude language, or NSFW content. If the original text contains explicit content, replace with tasteful romantic alternatives.';

    const contextMap = {
        question: 'a question for a couples app',
        partner_text: 'the partner-facing text for a two-part question',
        pack_name: 'a title for a question pack',
        pack_description: 'a description for a question pack',
        category_name: 'a category name',
    };

    let additionalRules = '';
    let fewShotExamples = '';
    if (type === 'question' || type === 'partner_text') {
        additionalRules = `
  IMPORTANT RULES - READ CAREFULLY:
  1. STYLE: Cards should be "Proposals" relative to a specific action, rather than interview questions.
     - GOOD: "Have a candlelit dinner with your partner", "Give your partner a massage".
     - BAD: "Do you want to have...", "Have you ever thought about...".
  2. ACCURACY: Do NOT rewrite the text effectively changing the action.
     - "Want a candlelit dinner?" -> "Have a candlelit dinner with your partner"
     - DO NOT change it to something unrelated like "Go to the movies".
     - Polish the phrasing, grammar, and tone, but keep the core action IDENTICAL.
  3. TONE: Engaging, romantic, or spicy (depending on context), but direct.
  4. ANATOMICAL CONSISTENCY: NEVER combine male-specific and female-specific acts as alternatives.
     - BAD: "Finger or give your partner a handjob" (requires different anatomy)
     - BAD: "Suck their cock or eat them out" (male vs female anatomy)
     - If text has mixed anatomy alternatives, keep ONE activity and remove the incompatible one.
  `;
        fewShotExamples = `
  === FEW-SHOT EXAMPLES ===
  ${type === 'question' ? `
  "Would you want to give me a massage?" → "Give your partner a sensual massage"
  "Have you ever thought about sex in public?" → "Have sex somewhere you might get caught"
  "maybe we could try using a blindfold sometime" → "Blindfold your partner and tease their senses"
  "cum on partner" → "Cum on your partner" (keep "cum", don't change to "come")
  ` : `
  "Receive a massage from your partner" → "Let your partner's hands work the tension from your body"
  "Get oral from your partner" → "Let your partner pleasure you with their mouth"
  "Be tied up" → "Let your partner tie you up and surrender control"
  "Moan for your partner" → "Let your partner make you moan"
  `}
  === END EXAMPLES ===
  `;
    }

    const prompt = `Please polish, improve, and tidy up the following text, which is used as ${contextMap[type] || 'text in the app'}.

  Original text: "${text}"

  ${explicitInstruction}

  ${additionalRules}
  ${fewShotExamples}

  Make it concise, engaging, and grammatically correct.
  Maintain the original intent and meaning.

  Return a JSON object with:
  - polished: The improved text string`;

    const response = await openai.chat.completions.create({
        model: getModel('polish'),
        messages: [
            {
                role: 'system',
                content: 'You are a professional editor for a couples app. Improve the copy while maintaining the tone. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.polished;
}

export interface TargetAnalysis {
    id: string;
    suggested_targets: string[] | null;
    suggested_initiator: string[] | null;
    reason: string;
}

export async function analyzeQuestionTargets(
    questions: { id: string; text: string; partner_text?: string | null; allowed_couple_genders: string[] | null; target_user_genders: string[] | null }[]
): Promise<TargetAnalysis[]> {
    const openai = getOpenAI();

    const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        partner_text: q.partner_text,
        current_targets: q.allowed_couple_genders,
        current_initiator: q.target_user_genders
    }));

    const prompt = `Analyze the following questions for a couples app and suggest:
1. "allowed_couple_genders" (which couple types can see this question)
2. "target_user_genders" (who should see this question FIRST as initiator - only relevant for two-part questions with partner_text)

COUPLE TARGET OPTIONS: 'male+male', 'female+male', 'female+female'
INITIATOR OPTIONS: 'male', 'female', 'non-binary'

RULES FOR COUPLE TARGETS (allowed_couple_genders):
- Default to ALL (null) if the action is gender-neutral/universal (e.g. kissing, massage, generic sex, anal).
- Limit ONLY if there is a clear, explicit anatomical requirement (e.g. genitalia-specific terms).
- SEX TOYS ARE GENDER-NEUTRAL: Vibrators, dildos, plugs, etc. can be used by ANYONE. Do NOT restrict based on toys.
  - "Control your partner's vibrator" -> ALL couples, ANY initiator (vibrators work on any body)
  - "Use a butt plug" -> ALL couples (everyone has a butt)

Examples of ACTUAL restrictions:
- "Blowjob" -> Needs penis -> Exclude F+F -> ['male+male', 'female+male']
- "Lick pussy" -> Needs vagina -> Exclude M+M -> ['female+male', 'female+female']
- "Vibrator", "dildo", "toy" -> NO restriction, works for everyone

RULES FOR INITIATOR (target_user_genders):
- ONLY relevant for TWO-PART questions (those with partner_text set).
- Analyze the "text" field to determine who should see this card FIRST as the initiator.
- ONLY set initiator if there is an EXPLICIT anatomical requirement in the text.
- SEX TOYS DO NOT IMPLY GENDER: "vibrator", "dildo", "toy", "plug" -> initiator: null (anyone can use/control toys)
- If text is gender-neutral, leave as null. When in doubt, use null.

Key considerations for initiator:
1. Does the "text" describe receiving something from a penis? -> Female initiator (in M+F context)
2. Does the "text" describe an action typically done BY someone with a penis (e.g., "my cum", "cum on you")? -> Male initiator
3. Does the "text" describe receiving penetration? -> Consider who is typically penetrated
4. Is the action truly symmetric with no gendered context? -> null

Examples:
- text: "Swallow your partner's cum" -> Receiving cum requires partner has penis, so in M+F this is female-oriented -> initiator: ['female']
- text: "Lick my cum off your body" -> "my cum" implies initiator produces cum (has penis) -> initiator: ['male']
- text: "Deep throat your partner" -> Requires partner has penis, so receiver-focused -> initiator: ['female'] for M+F
- text: "Give your partner a massage" -> Truly gender-neutral -> initiator: null
- text: "Let her ride you" / partner_text: "Ride your partner" -> "her" implies female partner -> initiator: ['male']
- text: "Finger your partner" / partner_text: "Be fingered" -> Receiver needs vagina -> suggested_targets: exclude M+M, initiator: null (either can finger)

Return a JSON object with an "analysis" array containing objects for questions where you have a recommendation.
Include ALL fields even if null. Include a "reason" string explaining your suggestions.

Structure:
{
   "analysis": [
     { "id": "...", "suggested_targets": ["male+male", "female+male"], "suggested_initiator": ["male"], "reason": "Text implies male initiator with female partner" }
   ]
}

Questions:
${JSON.stringify(simplifiedQuestions)}
`;

    const response = await openai.chat.completions.create({
        model: getModel('fix'),
        messages: [
            {
                role: 'system',
                content: 'You are a content analyzer for a couples app. You understand human anatomy and sexual acts. Return valid JSON.'
            },
            { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.analysis || [];
}

export interface TextAnalysis {
    id: string;
    suggested_text: string;
    suggested_partner_text: string | null;
    reason: string;
}

export interface ExtractedTopic {
    name: string;
    isNew: boolean;
    existingTopicId?: string;
}

export interface TopicExtractionResult {
    topics: ExtractedTopic[];
    reasoning: string;
}

export async function extractTopicsFromPack(
    packName: string,
    packDescription: string | null,
    questions: string[],
    existingTopics: { id: string; name: string }[]
): Promise<TopicExtractionResult> {
    const openai = getOpenAI();

    const existingTopicNames = existingTopics.map(t => t.name);
    const existingTopicsJson = JSON.stringify(existingTopics);

    const prompt = `Analyze the following question pack and extract relevant topics/kinks/interests that describe its content.

PACK NAME: "${packName}"
${packDescription ? `PACK DESCRIPTION: "${packDescription}"` : ''}

QUESTIONS IN THIS PACK:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

EXISTING TOPICS IN THE SYSTEM (prefer matching these when appropriate):
${existingTopicNames.length > 0 ? existingTopicNames.join(', ') : 'None yet'}

EXISTING TOPICS WITH IDs:
${existingTopicsJson}

INSTRUCTIONS:
1. Identify 1-5 topics that best describe this pack's content
2. Topics should be specific kinks, interests, or themes (e.g., "Bondage", "Exhibitionism", "Voyeurism", "Role Play", "Sensory Play", "Oral", "Anal", "Communication", "Romance", "Adventure")
3. ALWAYS prefer matching an existing topic if one fits - use the EXACT name and include the existingTopicId
4. Only suggest a new topic if nothing in the existing list is appropriate
5. Topic names should be title case (e.g., "Bondage" not "bondage")
6. Keep topics broad enough to be reusable across packs

Return a JSON object with:
- topics: Array of objects with:
  - name: The topic name (use exact existing name if matching)
  - isNew: false if matching an existing topic, true if suggesting a new one
  - existingTopicId: The ID of the existing topic if isNew is false (from the EXISTING TOPICS WITH IDs list)
- reasoning: Brief explanation of why these topics were chosen`;

    const response = await openai.chat.completions.create({
        model: getModel('fix'),
        messages: [
            {
                role: 'system',
                content: 'You are a content categorization expert for a couples intimacy app. You analyze question packs and identify relevant topics, kinks, and themes. Always prefer matching existing topics when possible. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    return JSON.parse(content) as TopicExtractionResult;
}

export async function analyzeQuestionText(
    questions: { id: string; text: string; partner_text?: string | null }[],
    isExplicit: boolean = false
): Promise<TextAnalysis[]> {
    const openai = getOpenAI();

    const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        partner_text: q.partner_text,
    }));

    const toneInstruction = isExplicit
        ? 'TONE: This is an EXPLICIT pack with NUANCED language. Use tasteful phrasing for common acts: "Have sex in X" (not "fuck in X"), "Perform oral" or "go down on" (not crude oral terms). BUT keep crude/specific terms when they ARE the activity: "Cum on your partner\'s tits" (cum is the act), "Use a cock ring" (that\'s the name), "Edge until they beg". The rule: crude terms for specific acts/objects, tasteful terms for general sex/oral. NEVER sanitize "cum" to "come" - they have different meanings.'
        : 'TONE: This is a NON-EXPLICIT pack. CRITICAL: Do NOT include any sexual acts, crude language, or NSFW content. Keep language romantic, sensual, or playful without crude/graphic terms. If explicit sexual content appears, replace with tasteful romantic alternatives or flag for removal.';

    // Use different examples based on explicit/non-explicit
    const symmetricExamples = isExplicit
        ? 'GOOD: "Have sex in a public place", "Roleplay a new scenario together", "Shower together", "Have a threesome"'
        : 'GOOD: "Cook a romantic dinner together", "Stargaze and share your dreams", "Give each other massages", "Dance together at home"';

    const asymmetricExamples = isExplicit
        ? `text (The Doer): Active command/proposal (e.g., "Tie your partner up", "Give your partner a massage").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Be tied up by your partner", "Receive a massage from your partner").
   - GOOD: "Spank your partner" / "Be spanked by your partner"`
        : `text (The Doer): Active command/proposal (e.g., "Write a love letter to your partner", "Plan a surprise date for your partner").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Receive a love letter from your partner", "Be surprised with a date by your partner").
   - GOOD: "Give your partner a massage" / "Receive a massage from your partner"`;

    const prompt = `Analyze the following questions for a couples app and suggest improved text that follows our style guidelines.

${toneInstruction}

The app uses a swipe-based interface (Like/Dislike/Maybe).
Cards should be "Proposals" relative to a specific action, NOT interview questions.

For each question, decide if it is a SYMMETRIC activity (shared) or ASYMMETRIC action (one-way).

1. SYMMETRIC Activities (Single Card - partner_text should be null):
   - Use for shared experiences where both partners do the same thing together.
   - Phrasing: Direct action proposal.
   - ${symmetricExamples}
   - BAD: "Have you ever thought about...", "Do you think we should...", "How about we..."

2. ASYMMETRIC Actions (Two-Part Card - needs both text and partner_text):
   - Use for actions where one partner does something TO/FOR the other, or where roles differ.
   - text = what the INITIATOR does (their action/perspective)
   - partner_text = what the RECEIVER does/experiences (their action/perspective)
   - ${asymmetricExamples}
   - IMPORTANT: partner_text should describe the RECEIVER's experience clearly:
     - text: "Send your partner to the bathroom and follow a minute later"
     - partner_text: "Go to the bathroom and wait for your partner to join you" (NOT "Wait for your partner to follow you")
   - When initiator CAUSES a response (moan, cum, beg, etc.), partner_text should frame as ALLOWING/RECEIVING:
     - text: "Make your partner moan in public" → partner_text: "Let your partner make you moan in public"
     - NOT: "Moan for your partner in public" (sounds like deliberate performance, not natural response)
   - BAD: "Would you like to...?" (Ambiguous who "me" is)

CRITICAL RULES:
1. PRESERVE THE CORE ACTION - Do NOT change what the question is about. Only improve phrasing.
2. Keep text SHORT and DIRECT - no explanatory parentheticals. Aim for 5-12 words.
3. Remove wishy-washy language: "Would you want to...", "Have you ever...", "Do you think...", "...fantasy"
4. Make it direct and actionable.
5. For asymmetric cards, ensure text is initiator-focused and partner_text is receiver-focused.
6. Use "your partner" instead of "me", "you", "him", "her" to keep it gender-neutral.
7. If a question is ALREADY well-phrased, do NOT include it in the results.
8. NEVER add explanatory text in parentheses - keep the proposal clean and simple.
9. NEVER MIX ANATOMICALLY INCOMPATIBLE ACTIVITIES - Do NOT combine male-specific and female-specific acts as alternatives in the same question. A partner has ONE set of anatomy.
   - BAD: "Finger or give your partner a handjob" (fingering = female anatomy, handjob = male anatomy)
   - BAD: "Suck your partner's cock or eat them out" (cock = male, eating out = female)
   - GOOD: Pick ONE activity appropriate for the question's target audience
   - If a question has mixed anatomy alternatives, choose the one that fits the pack's theme or keep the first one
10. MAKE PARTNER_TEXT APPEALING - Don't just grammatically flip the text. Make the receiver feel excited:
    - BAD: "Receive a massage from your partner" (boring, clinical)
    - GOOD: "Let your partner's hands explore and relax your body" (enticing)
11. FLAG CLICHÉS for improvement - "candlelit dinner", "rose petals", "bubble bath", "Netflix and chill" are overused

=== FEW-SHOT EXAMPLES ===
These show how to fix common issues:

FIXING WISHY-WASHY LANGUAGE:
Input: { "text": "Would you want to try giving your partner a massage?", "partner_text": null }
Output: { "suggested_text": "Give your partner a sensual full-body massage", "suggested_partner_text": "Let your partner's hands work the tension from your body", "reason": "Removed question format, made it direct, added appealing partner_text" }

FIXING BORING PARTNER_TEXT:
Input: { "text": "Go down on your partner", "partner_text": "Receive oral from your partner" }
Output: { "suggested_text": "Go down on your partner", "suggested_partner_text": "Let your partner pleasure you with their mouth", "reason": "Partner text was clinical/boring, made it enticing" }

FIXING CAUSED-RESPONSE FRAMING:
Input: { "text": "Make your partner moan in public", "partner_text": "Moan for your partner in public" }
Output: { "suggested_text": "Make your partner moan in public", "suggested_partner_text": "Let your partner make you moan in public", "reason": "Partner text sounded like deliberate performance, reframed as allowing/receiving" }

FIXING MIXED ANATOMY:
Input: { "text": "Finger or give your partner a handjob at a movie theater", "partner_text": "Get fingered or a handjob at a movie theater" }
Output: { "suggested_text": "Touch your partner intimately at a movie theater", "suggested_partner_text": "Let your partner touch you intimately at a movie theater", "reason": "Mixed male/female anatomy, made it gender-neutral" }

FIXING CONFUSING PARTNER_TEXT:
Input: { "text": "Send your partner to the bathroom and follow them", "partner_text": "Wait for your partner to follow you" }
Output: { "suggested_text": "Send your partner to the bathroom and follow a minute later", "suggested_partner_text": "Go to the bathroom and wait for your partner to join you", "reason": "Partner text was confusing, clarified receiver's action" }

FIXING TOO LONG:
Input: { "text": "Take your partner out to a nice romantic restaurant where you can have a lovely dinner together and share your dreams for the future", "partner_text": null }
Output: { "suggested_text": "Plan a surprise dinner date at a special restaurant", "suggested_partner_text": null, "reason": "Way too long, condensed to core action" }

ALREADY GOOD (do not include in suggestions):
Input: { "text": "Blindfold your partner and feed them mysterious foods", "partner_text": "Let your partner blindfold you and tantalize your taste buds" }
(No output - this is already well-phrased)

=== END EXAMPLES ===

Return a JSON object with a "suggestions" array containing ONLY questions that need improvement.
Each object should have:
- id: The question ID
- suggested_text: The improved text (short, direct, no parentheticals)
- suggested_partner_text: The improved partner_text (or null if symmetric)
- reason: Brief explanation of what was improved

Questions:
${JSON.stringify(simplifiedQuestions)}
`;

    const systemMessage = isExplicit
        ? 'You are an adult content editor for a couples intimacy app. Use nuanced language: tasteful phrasing for general acts (have sex, perform oral) but crude specific terms when relevant (cum, cock ring, etc). Preserve original intent. Always respond with valid JSON only.'
        : 'You are a professional content editor for a couples app. You improve question phrasing to be direct, actionable, and engaging while preserving the original intent. Always respond with valid JSON only.';

    const response = await openai.chat.completions.create({
        model: getModel('fix'),
        messages: [
            {
                role: 'system',
                content: systemMessage
            },
            { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.suggestions || [];
}

// =============================================================================
// COUNCIL REVIEW FUNCTIONS
// =============================================================================

const REVIEW_GUIDELINES = `
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

export async function reviewGeneratedQuestions(
    questions: GeneratedQuestion[],
    packContext: { name: string; description?: string | null; isExplicit: boolean; tone: ToneLevel }
): Promise<ReviewResult> {
    const openai = getOpenAI();
    const config = getCouncilConfig();

    // Null safety check
    if (!questions || questions.length === 0) {
        return {
            reviews: [],
            summary: { passed: 0, flagged: 0, rejected: 0, overallQuality: 0 },
        };
    }

    const questionsForReview = questions.map((q, i) => ({
        index: i,
        text: q.text,
        partner_text: q.partner_text || null,
        intensity: q.intensity,
        location_type: q.location_type,
        effort_level: q.effort_level,
    }));

    const toneDescription = TONE_LEVELS.find(t => t.level === packContext.tone)?.label || 'Unknown';

    const prompt = `You are a quality reviewer for a couples intimacy app. Review each generated question against our guidelines.

PACK CONTEXT:
- Pack Name: "${packContext.name}"
${packContext.description ? `- Pack Description: "${packContext.description}"` : ''}
- Content Type: ${packContext.isExplicit ? 'EXPLICIT (adult content allowed)' : 'NON-EXPLICIT (clean/romantic only)'}
- Tone Level: ${packContext.tone} (${toneDescription})

${REVIEW_GUIDELINES}

VERDICT RULES:
- PASS: All scores >= 7, no major issues
- FLAG: Any score 5-7, or minor issues worth noting (admin should review but can use)
- REJECT: Any score < 5, or major violations (mixed anatomy, wrong intensity, severe guideline violation)

QUESTIONS TO REVIEW:
${JSON.stringify(questionsForReview, null, 2)}

Return a JSON object with:
{
  "reviews": [
    {
      "index": 0,
      "verdict": "pass" | "flag" | "reject",
      "issues": ["Issue 1", "Issue 2"],
      "suggestions": "Optional improvement suggestion",
      "scores": {
        "guidelineCompliance": 8,
        "creativity": 7,
        "clarity": 9,
        "intensityAccuracy": 8
      }
    }
  ]
}

Review ALL questions. Be thorough but fair - only flag/reject for genuine issues.`;

    const response = await openai.chat.completions.create({
        model: config.reviewerModel,
        messages: [
            {
                role: 'system',
                content: 'You are a quality assurance reviewer for a couples intimacy app. You evaluate generated questions for guideline compliance, creativity, clarity, and accuracy. Be thorough but fair. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No review content generated');

    // Strip markdown code blocks if present (some models ignore response_format)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
        // Remove opening ```json or ``` and closing ```
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonContent);
    const reviews: QuestionReview[] = parsed.reviews || [];

    // Calculate summary
    const passed = reviews.filter(r => r.verdict === 'pass').length;
    const flagged = reviews.filter(r => r.verdict === 'flag').length;
    const rejected = reviews.filter(r => r.verdict === 'reject').length;

    // Calculate overall quality as average of all scores
    let totalScore = 0;
    let scoreCount = 0;
    for (const review of reviews) {
        if (review.scores) {
            totalScore += review.scores.guidelineCompliance || 0;
            totalScore += review.scores.creativity || 0;
            totalScore += review.scores.clarity || 0;
            totalScore += review.scores.intensityAccuracy || 0;
            scoreCount += 4;
        }
    }
    const overallQuality = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;

    return {
        reviews,
        summary: {
            passed,
            flagged,
            rejected,
            overallQuality,
        },
    };
}

/**
 * Generate questions using a specific model
 */
async function generateQuestionsWithModel(
    model: string,
    packName: string,
    count: number,
    intensity: number | undefined,
    tone: ToneLevel,
    packDescription: string | undefined,
    existingQuestions: string[] | undefined,
    crudeLang: boolean,
    inspiration: string | undefined
): Promise<GeneratedQuestion[]> {
    const openai = getOpenAI();
    const isClean = tone === 0;
    const isExplicit = tone >= 4;

    const crudeLangInstruction = crudeLang
        ? '\n\nCRUDE LANGUAGE OVERRIDE: Ignore nuanced language rules. Use crude, vulgar terms throughout - "fuck" instead of "have sex", "suck cock" instead of "perform oral", etc. Be raw and direct like uncensored sexting.'
        : '';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide the types of questions you generate.`
        : '';

    const intensityInstruction = isClean
        ? 'All questions should be intensity level 1 (non-physical activities).'
        : intensity
            ? `All questions should be at intensity level ${intensity}.`
            : 'Vary the intensity levels from 1 to 5 across the questions for good variety.';

    const toneInstructions: Record<ToneLevel, string> = {
        0: 'WILDNESS LEVEL: EVERYDAY. Generate non-romantic activities only. Focus on communication, teamwork, fun, personal growth, and bonding WITHOUT any romantic or sexual undertones. Examples: "Cook a new recipe together", "Play a board game", "Send your partner a compliment while they\'re at work", "Plan a weekend adventure". NO flirting, NO romance, NO intimacy.',
        1: 'WILDNESS LEVEL: SWEET. Generate romantic but innocent activities. Focus on emotional connection, love, and tenderness. Examples: "Write your partner a love letter", "Plan a surprise date night", "Cuddle and watch the sunset", "Give your partner a back massage". NO sexual content.',
        2: 'WILDNESS LEVEL: FLIRTY. Generate playful, teasing activities with light innuendo. Examples: "Send a flirty text during the day", "Whisper something suggestive in your partner\'s ear", "Give your partner a lingering kiss goodbye". Suggestive but NOT explicitly sexual.',
        3: 'WILDNESS LEVEL: INTIMATE. Generate sensual activities that imply intimacy without being graphic. Examples: "Give your partner a full-body massage", "Shower together", "Make out somewhere unexpected", "Sleep naked together". Passionate but soft - no explicit sex acts.',
        4: 'WILDNESS LEVEL: SEXUAL. Generate standard sexual activities. Examples: "Go down on your partner", "Have sex in a new position", "Use a vibrator together", "Wake your partner up with oral". Direct language, avoid clinical terms. This is vanilla sex - adventurous but not extreme.',
        5: 'WILDNESS LEVEL: WILD. Generate extreme, kinky, or taboo activities. Think: public sex, exhibitionism, BDSM, risky situations, intense kinks. Examples: "Get creampied by your partner and go to dinner", "Have sex somewhere you might get caught", "Let your partner tie you up and use you", "Edge each other for an hour before allowing release". Push boundaries. Use crude terms when they ARE the activity (cum, cock ring) but tasteful phrasing for general acts (have sex, not fuck). NEVER sanitize "cum" to "come".',
    };

    const toneInstruction = toneInstructions[tone];

    const symmetricExamples = isClean
        ? 'GOOD: "Cook a new recipe together", "Play a board game", "Go on a hike", "Have a deep conversation about your goals".'
        : isExplicit
            ? 'GOOD: "Fuck in a risky place", "Try a new position", "Sixty-nine together", "Watch porn and recreate a scene".'
            : 'GOOD: "Cook a romantic dinner together", "Stargaze and share dreams", "Give each other massages", "Dance together at home".';

    const asymmetricExamples = isClean
        ? `Examples:
   - text: "Cook your partner their favorite meal" → partner_text: "Have your partner cook your favorite meal"
   - text: "Plan a surprise for your partner" → partner_text: "Be surprised by your partner"
   - text: "Give your partner a compliment" → partner_text: "Receive a compliment from your partner"`
        : isExplicit
            ? `Examples:
   - text: "Go down on your partner" → partner_text: "Have your partner go down on you"
   - text: "Send your partner a nude" → partner_text: "Receive a nude from your partner"
   - text: "Tie your partner up" → partner_text: "Get tied up by your partner"
   - text: "Spank your partner" → partner_text: "Get spanked by your partner"`
            : `Examples:
   - text: "Give your partner a massage" → partner_text: "Receive a massage from your partner"
   - text: "Write your partner a love letter" → partner_text: "Receive a love letter from your partner"
   - text: "Plan a surprise date for your partner" → partner_text: "Be surprised with a date by your partner"`;

    const explicitWarning = isClean
        ? '\n\nCRITICAL: This is a CLEAN pack with NO romantic or sexual content. Focus ONLY on communication, activities, challenges, and bonding. NO romance, NO flirting, NO intimacy, NO physical affection beyond friendly gestures.'
        : isExplicit
            ? ''
            : '\n\nCRITICAL: This is a NON-EXPLICIT pack. Do NOT include any sexual acts, crude language, or NSFW content. Keep all proposals romantic, playful, or emotionally intimate without being sexually explicit.';

    const descriptionContext = packDescription
        ? `\nPack Description: "${packDescription}"\nUse this description to guide the theme and style of questions.`
        : '';

    const existingQuestionsContext = existingQuestions && existingQuestions.length > 0
        ? `\n\nEXISTING QUESTIONS IN THIS PACK (DO NOT DUPLICATE OR CREATE SIMILAR VARIATIONS):
${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

CRITICAL: Generate completely NEW and DIFFERENT questions. Do not repeat any of the above questions or create minor variations of them. Each new question must offer a genuinely distinct activity or experience.`
        : '';

    const prompt = `Generate ${count} unique questions for a couples' intimacy question pack called "${packName}".${descriptionContext}${existingQuestionsContext}

${INTENSITY_GUIDE_SHORT}

${intensityInstruction}
${toneInstruction}${explicitWarning}${crudeLangInstruction}${inspirationInstruction}

IMPORTANT: The app uses a swipe-based interface (Like/Dislike/Maybe).
Cards should be "Proposals" for specific actions, NOT interview questions.

CRITICAL LANGUAGE RULES:
- ALWAYS use "your partner" - NEVER use "me", "I", "you" (as the receiver), "him", "her"
- BAD: "Send me a photo" (who is "me"?), "Let me spank you", "I want you to..."
- GOOD: "Send your partner a photo", "Spank your partner", "Give your partner..."
- The card reader is the DOER. Their partner is "your partner".

For each question, decide if it is SYMMETRIC (shared) or ASYMMETRIC (one does to the other):

1. SYMMETRIC Activities (partner_text = null):
   - Both partners do the same thing together.
   - ${symmetricExamples}

2. ASYMMETRIC Actions (requires partner_text):
   - One partner does something TO/FOR the other, or roles differ.
   - text = what the INITIATOR does
   - partner_text = what the RECEIVER does/experiences
   - ${asymmetricExamples}

Required JSON structure:
- text: The proposal (DOER's perspective, uses "your partner")
- partner_text: For asymmetric only - RECEIVER's perspective
- intensity: 1-5 based on INTENSITY LEVELS above.
- requires_props: (optional) Array of items needed
- location_type: (optional) "home" | "public" | "outdoors" | "travel" | "anywhere"
- effort_level: (optional) "spontaneous" | "low" | "medium" | "planned"

Return a JSON object with a "questions" array.`;

    const systemMessages: Record<ToneLevel, string> = {
        0: 'You are a content writer for a couples app. Generate everyday activities focused on bonding, communication, and fun. No romance or intimacy. Always respond with valid JSON only.',
        1: 'You are a content writer for a couples app. Generate sweet, romantic activities that help couples connect emotionally. Keep it innocent and wholesome. Always respond with valid JSON only.',
        2: 'You are a content writer for a couples app. Generate flirty, playful activities with light teasing and innuendo. Suggestive but not sexual. Always respond with valid JSON only.',
        3: 'You are a content writer for a couples app. Generate intimate, sensual activities that imply passion without being explicit. Always respond with valid JSON only.',
        4: 'You are a content writer for an adult couples app. Generate sexual activities with direct, natural language. Write like a sex-positive friend - not clinical. Always respond with valid JSON only.',
        5: 'You are a content writer for an adult couples app. Generate wild, extreme, kinky activities that push boundaries. Use crude terms when they ARE the act but tasteful phrasing for general sex/oral. Never use clinical terms. Always respond with valid JSON only.',
    };

    const response = await openai.chat.completions.create({
        model: model,
        messages: [
            {
                role: 'system',
                content: systemMessages[tone],
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.questions as GeneratedQuestion[];
}

/**
 * Ask the reviewer to select the best generation from multiple candidates
 */
export interface SelectionResult {
    selectedIndex: number;
    reviews: QuestionReview[];
    summary: ReviewResult['summary'];
    reasoning: string;
}

async function selectBestGeneration(
    candidates: GenerationCandidate[],
    packContext: { name: string; description?: string | null; isExplicit: boolean; tone: ToneLevel }
): Promise<SelectionResult> {
    const openai = getOpenAI();
    const config = getCouncilConfig();

    // If only one candidate, just review it normally
    if (candidates.length === 1) {
        const reviewResult = await reviewGeneratedQuestions(candidates[0].questions, packContext);
        return {
            selectedIndex: 0,
            reviews: reviewResult.reviews,
            summary: reviewResult.summary,
            reasoning: 'Single generator - no selection needed',
        };
    }

    const toneDescription = TONE_LEVELS.find(t => t.level === packContext.tone)?.label || 'Unknown';

    // Build prompt for selection
    const candidatesForReview = candidates.map((c, i) => ({
        generatorIndex: i,
        generatorModel: c.generatorModel,
        questions: c.questions.map((q, qi) => ({
            index: qi,
            text: q.text,
            partner_text: q.partner_text || null,
            intensity: q.intensity,
        })),
    }));

    const prompt = `You are a quality reviewer for a couples intimacy app. You have received ${candidates.length} different sets of generated questions from different AI models. Your task is to:

1. COMPARE all sets and SELECT the BEST one overall
2. REVIEW the selected set in detail

PACK CONTEXT:
- Pack Name: "${packContext.name}"
${packContext.description ? `- Pack Description: "${packContext.description}"` : ''}
- Content Type: ${packContext.isExplicit ? 'EXPLICIT (adult content allowed)' : 'NON-EXPLICIT (clean/romantic only)'}
- Tone Level: ${packContext.tone} (${toneDescription})

${REVIEW_GUIDELINES}

CANDIDATE SETS:
${JSON.stringify(candidatesForReview, null, 2)}

SELECTION CRITERIA (in order of importance):
1. Overall quality and creativity of questions
2. Variety and uniqueness within the set
3. Adherence to pack theme and tone
4. Proper intensity grading
5. Correct use of "your partner" language
6. Quality of partner_text for asymmetric questions

Return a JSON object with:
{
  "selectedIndex": <0-based index of the best candidate set>,
  "reasoning": "<brief explanation of why this set was chosen>",
  "reviews": [
    {
      "index": <question index within selected set>,
      "verdict": "pass" | "flag" | "reject",
      "issues": ["Issue 1", "Issue 2"],
      "suggestions": "Optional improvement suggestion",
      "scores": {
        "guidelineCompliance": 1-10,
        "creativity": 1-10,
        "clarity": 1-10,
        "intensityAccuracy": 1-10
      }
    }
  ]
}

Select the best set and review ALL questions in that set.`;

    const response = await openai.chat.completions.create({
        model: config.reviewerModel,
        messages: [
            {
                role: 'system',
                content: 'You are a quality assurance reviewer for a couples intimacy app. You compare multiple AI-generated question sets and select the best one, then provide detailed reviews. Be thorough but fair. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No selection content generated');

    // Strip markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonContent);
    const selectedIndex = parsed.selectedIndex ?? 0;
    const reviews: QuestionReview[] = parsed.reviews || [];
    const reasoning = parsed.reasoning || 'No reasoning provided';

    // Calculate summary
    const passed = reviews.filter(r => r.verdict === 'pass').length;
    const flagged = reviews.filter(r => r.verdict === 'flag').length;
    const rejected = reviews.filter(r => r.verdict === 'reject').length;

    let totalScore = 0;
    let scoreCount = 0;
    for (const review of reviews) {
        if (review.scores) {
            totalScore += review.scores.guidelineCompliance || 0;
            totalScore += review.scores.creativity || 0;
            totalScore += review.scores.clarity || 0;
            totalScore += review.scores.intensityAccuracy || 0;
            scoreCount += 4;
        }
    }
    const overallQuality = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;

    return {
        selectedIndex,
        reviews,
        summary: {
            passed,
            flagged,
            rejected,
            overallQuality,
        },
        reasoning,
    };
}

export async function generateQuestionsWithCouncil(
    packName: string,
    count: number = 10,
    intensity?: number,
    tone: ToneLevel = 3,
    packDescription?: string,
    existingQuestions?: string[],
    crudeLang: boolean = false,
    inspiration?: string
): Promise<CouncilGenerationResult> {
    const config = getCouncilConfig();

    // If council is disabled, use the default generation model
    if (!config.enabled) {
        const startGen = Date.now();
        const questions = await generateQuestions(
            packName,
            count,
            intensity,
            tone,
            packDescription,
            existingQuestions,
            crudeLang,
            inspiration
        );
        const genTime = Date.now() - startGen;

        return {
            questions,
            reviews: [],
            summary: null,
            selectedGeneratorIndex: null,
            allCandidates: null,
            metadata: {
                generatorModels: [getModel('generate')],
                reviewerModel: null,
                totalGenerationTime: genTime,
                reviewTime: 0,
            },
        };
    }

    // Step 1: Generate questions with all configured generators in parallel
    const startGen = Date.now();
    const generatorPromises = config.generators.map(async (gen, index) => {
        const genStart = Date.now();
        try {
            const questions = await generateQuestionsWithModel(
                gen.model,
                packName,
                count,
                intensity,
                tone,
                packDescription,
                existingQuestions,
                crudeLang,
                inspiration
            );
            return {
                generatorIndex: index,
                generatorModel: gen.model,
                questions,
                generationTime: Date.now() - genStart,
            } as GenerationCandidate;
        } catch (error) {
            console.error(`Generator ${index} (${gen.model}) failed:`, error);
            return null;
        }
    });

    const results = await Promise.all(generatorPromises);
    const successfulCandidates = results.filter((r): r is GenerationCandidate => r !== null);
    const totalGenerationTime = Date.now() - startGen;

    // If no generators succeeded, throw error
    if (successfulCandidates.length === 0) {
        throw new Error('All generators failed to produce results');
    }

    // Step 2: Have the reviewer select the best generation and review it
    const startReview = Date.now();
    const isExplicit = tone >= 4;

    try {
        const selectionResult = await selectBestGeneration(successfulCandidates, {
            name: packName,
            description: packDescription,
            isExplicit,
            tone,
        });
        const reviewTime = Date.now() - startReview;

        const selectedCandidate = successfulCandidates[selectionResult.selectedIndex];

        return {
            questions: selectedCandidate.questions,
            reviews: selectionResult.reviews,
            summary: selectionResult.summary,
            selectedGeneratorIndex: selectionResult.selectedIndex,
            allCandidates: successfulCandidates,
            metadata: {
                generatorModels: config.generators.map(g => g.model),
                reviewerModel: config.reviewerModel,
                totalGenerationTime,
                reviewTime,
            },
        };
    } catch (error) {
        // If selection/review fails, return the first successful generation without review
        console.error('Council selection/review failed:', error);
        const firstCandidate = successfulCandidates[0];

        return {
            questions: firstCandidate.questions,
            reviews: [],
            summary: null,
            selectedGeneratorIndex: 0,
            allCandidates: successfulCandidates,
            metadata: {
                generatorModels: config.generators.map(g => g.model),
                reviewerModel: null,
                totalGenerationTime,
                reviewTime: 0,
            },
        };
    }
}
