import OpenAI from 'openai';

// Note: In production, this should be called from a backend/edge function
// to avoid exposing the API key

const getOpenAI = () => {
    const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const openAIKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (openRouterKey) {
        return new OpenAI({
            apiKey: openRouterKey,
            baseURL: 'https://openrouter.ai/api/v1',
            dangerouslyAllowBrowser: true,
        });
    }

    if (!openAIKey) {
        throw new Error('VITE_OPENAI_API_KEY or VITE_OPENROUTER_API_KEY is missing');
    }

    return new OpenAI({
        apiKey: openAIKey,
        dangerouslyAllowBrowser: true,
    });
};

type ModelPurpose = 'generate' | 'fix' | 'polish';

const getModel = (purpose?: ModelPurpose) => {
    // Granular model selection by purpose
    // Falls back to VITE_AI_MODEL, then to default
    const defaultModel = 'gpt-4o-mini';
    const fallback = import.meta.env.VITE_AI_MODEL || defaultModel;

    if (!purpose) return fallback;

    switch (purpose) {
        case 'generate':
            return import.meta.env.VITE_AI_MODEL_GENERATE || fallback;
        case 'fix':
            return import.meta.env.VITE_AI_MODEL_FIX || fallback;
        case 'polish':
            return import.meta.env.VITE_AI_MODEL_POLISH || fallback;
        default:
            return fallback;
    }
};

export interface GeneratedPack {
    name: string;
    description: string;
}

export interface GeneratedQuestion {
    text: string;
    partner_text?: string;
    intensity: number;
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
        ? 'Use crude, vulgar, and raw language. Be blunt and use everyday explicit words.'
        : 'Use tasteful, refined language. Avoid crude or vulgar terms even for explicit content.';

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

// Tone levels for content generation (controls language/explicitness)
export const TONE_LEVELS = [
    { level: 0, label: 'Clean', description: 'No romance or intimacy - communication, activities, fun' },
    { level: 1, label: 'Romantic', description: 'Sweet, loving, emotional connection focus' },
    { level: 2, label: 'Playful', description: 'Flirty, teasing, fun and lighthearted' },
    { level: 3, label: 'Sensual', description: 'Intimate, passionate, suggestive but tasteful' },
    { level: 4, label: 'Spicy', description: 'Bold, adventurous, mildly explicit' },
    { level: 5, label: 'Explicit', description: 'Raw, graphic, NSFW content' },
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
        ? '\n\nCRUDE LANGUAGE: Use crude, vulgar, raw language throughout. Be blunt, direct, and use everyday explicit words like people actually use in real life. Avoid euphemisms or clinical terms.'
        : '\n\nLANGUAGE STYLE: Use tasteful, refined language. Avoid crude or vulgar terms. For explicit content, use direct but non-crude terms (e.g., "oral sex" not "blowjob", "have sex" not "fuck").';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide the types of questions you generate.`
        : '';

    const intensityInstruction = isClean
        ? 'All questions should be intensity level 1 (non-physical activities).'
        : intensity
            ? `All questions should be at intensity level ${intensity}.`
            : 'Vary the intensity levels from 1 to 5 across the questions for good variety.';

    const toneInstructions: Record<ToneLevel, string> = {
        0: 'TONE: Completely clean and non-romantic. Focus on communication, teamwork, fun activities, personal growth, and bonding WITHOUT any romantic or sexual undertones. Think conversation starters, bucket list activities, games, challenges, and getting to know each other better. NO flirting, NO romance, NO intimacy references.',
        1: 'TONE: Romantic and sweet. Focus on emotional connection, love, and tenderness. Keep content clean and wholesome - NO sexual content whatsoever. Think date nights, compliments, and heartfelt moments.',
        2: 'TONE: Playful and flirty. Light teasing, fun activities, and cheeky suggestions. Mildly suggestive but NOTHING explicit or sexual. Think playful banter and innocent mischief.',
        3: 'TONE: Sensual and intimate. Passionate and suggestive content that implies intimacy without being graphic. Use tasteful language - "make love" rather than crude terms. Romantic but with heat. AVOID explicit sexual acts or crude terminology.',
        4: 'TONE: Spicy and bold. Adventurous sexual content with direct, natural language. Use everyday terms like "oral sex", "finger", "go down on", "handjob", "turn on". AVOID clinical/medical terms like "stimulate", "arousal", "genitals", "penetration". Write like real people talk about sex.',
        5: 'TONE: Explicit adult content with NUANCED language. Use tasteful phrasing for common acts: "Have sex in X" (not "fuck in X"), "Perform oral" or "go down on" (not crude oral terms). BUT use crude/specific terms when they ARE the activity: "Cum on your partner\'s tits" (cum is the act), "Use a cock ring" (that\'s what it\'s called), "Edge your partner until they beg to cum". The rule: crude terms for specific acts/objects, tasteful terms for general sex/oral. NEVER sanitize "cum" to "come" - they have different meanings.',
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

Return a JSON object with a "questions" array.
Mix symmetric and asymmetric proposals.`;

    const systemMessages: Record<ToneLevel, string> = {
        0: 'You are a content writer for a couples app focused on communication, activities, and bonding. Generate clean, non-romantic content like conversation starters, fun challenges, and activities. No romance or intimacy. Always respond with valid JSON only.',
        1: 'You are a romantic content writer for a couples relationship app. Generate sweet, wholesome content that helps couples connect emotionally. Always respond with valid JSON only.',
        2: 'You are a playful content writer for a couples relationship app. Generate fun, flirty content that helps couples have fun together. Always respond with valid JSON only.',
        3: 'You are a sensual content writer for a couples relationship app. Generate passionate, intimate content that helps couples explore their desires tastefully. Always respond with valid JSON only.',
        4: 'You are a bold content writer for an adult couples app. Write like a sex-positive friend giving suggestions - natural, direct, not clinical. Avoid medical terminology. Always respond with valid JSON only.',
        5: 'You are an adult content writer for a couples intimacy app. Use nuanced language: tasteful phrasing for general acts (have sex, perform oral) but crude specific terms when relevant (cum, cock ring, etc). Never use clinical terms. Always respond with valid JSON only.',
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
        ? '\nUse crude, vulgar, and raw language in the names and descriptions.'
        : '\nUse tasteful, refined language. Avoid crude or vulgar terms.';

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
        ? '\nUse crude, vulgar, and raw language in the pack names and descriptions.'
        : '\nUse tasteful, refined language. Avoid crude or vulgar terms.';

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
    }

    const prompt = `Please polish, improve, and tidy up the following text, which is used as ${contextMap[type] || 'text in the app'}.
  
  Original text: "${text}"
  
  ${explicitInstruction}
  
  ${additionalRules}

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
2. Keep text SHORT and DIRECT - no explanatory parentheticals.
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
