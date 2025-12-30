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

export async function generatePack(categoryName?: string, explicit: boolean = false): Promise<GeneratedPack> {
    const openai = getOpenAI();

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and uncensored themes (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const prompt = categoryName
        ? `Generate a creative question pack for a couples' intimacy/connection app in the category "${categoryName}". 
       The pack should help couples explore their relationship and desires together.
       
       ${explicitInstruction}
       
       Return a JSON object with:
       - name: A catchy, engaging pack name (3-6 words)
       - description: A brief, enticing description (1-2 sentences)
       
       Make it romantic, playful, and relationship-focused.`
        : `Generate a creative question pack for a couples' intimacy/connection app.
       The pack should help couples explore their relationship and desires together.
       
       ${explicitInstruction}
       
       Return a JSON object with:
       - name: A catchy, engaging pack name (3-6 words)  
       - description: A brief, enticing description (1-2 sentences)
       
       Make it romantic, playful, and relationship-focused.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content writer for a couples relationship app. Generate engaging, tasteful content that helps couples connect. Always respond with valid JSON only.',
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

// Intensity levels for questions (controls physical intimacy level)
// This guide helps AI consistently grade question intensity
export const INTENSITY_GUIDE = `
INTENSITY GRADING GUIDE - Use this to assign intensity levels consistently:

Level 1 - LIGHT (Emotional/Verbal):
- Talking, sharing feelings, compliments, emotional vulnerability
- Non-physical activities: writing letters, planning dates, sharing dreams
- Examples: "Share your biggest dream with your partner", "Write a love note", "Tell your partner what you love most about them"

Level 2 - MILD (Light Physical):
- Light physical affection: holding hands, hugging, cuddling
- Gentle kisses, playing with hair, light touches
- Non-sexual physical closeness: dancing together, sleeping in each other's arms
- Examples: "Give your partner a forehead kiss", "Cuddle while watching a movie", "Hold hands during dinner"

Level 3 - MODERATE (Sensual/Intimate):
- Making out, passionate kissing, intimate massage
- Sensual touch over clothes, caressing, teasing
- Showering together (non-sexual), skinny dipping
- Suggestive activities that build tension without explicit sexual acts
- Examples: "Give your partner a sensual massage", "Make out in an unexpected place", "Slow dance intimately"

Level 4 - SPICY (Sexual without Penetration):
- Oral sex, manual stimulation, mutual masturbation
- Foreplay activities, using hands/mouth on genitals
- Using toys externally, edging, teasing to climax
- Nakedness with sexual intent
- Examples: "Give your partner oral", "Touch your partner until they climax", "Use a vibrator on your partner"

Level 5 - INTENSE (Penetration/Advanced):
- Vaginal or anal penetration (sex, toys, fingers)
- Kinks: bondage, role-play with power dynamics, BDSM
- Group activities, exhibitionism, voyeurism
- Any activity involving penetration or advanced kinks
- Examples: "Have sex in a new location", "Try anal play", "Tie your partner up and have your way with them"

IMPORTANT: Intensity is about the PHYSICAL INTIMACY level, not the language used.
A question can be intensity 5 with tasteful language (non-explicit pack) or crude language (explicit pack).
`;

// Condensed version for prompts (to save tokens)
export const INTENSITY_GUIDE_SHORT = `
INTENSITY LEVELS:
1 (Light): Talking, emotional sharing, compliments, non-physical activities
2 (Mild): Holding hands, hugging, cuddling, gentle kisses, light touch
3 (Moderate): Making out, sensual massage, passionate kissing, intimate but not sexual
4 (Spicy): Oral sex, manual stimulation, foreplay, sexual touching without penetration
5 (Intense): Penetration (vaginal/anal), advanced kinks, BDSM, group activities
`;

// Intensity levels for UI display (consistent with AI grading)
export const INTENSITY_LEVELS = [
    { level: 1, label: 'Light', description: 'Talking, emotional sharing, compliments, non-physical', color: 'bg-green-500' },
    { level: 2, label: 'Mild', description: 'Holding hands, hugging, cuddling, gentle kisses', color: 'bg-lime-500' },
    { level: 3, label: 'Moderate', description: 'Making out, sensual massage, passionate kissing', color: 'bg-yellow-500' },
    { level: 4, label: 'Spicy', description: 'Oral, manual stimulation, foreplay, sexual without penetration', color: 'bg-orange-500' },
    { level: 5, label: 'Intense', description: 'Penetration, advanced kinks, BDSM, group activities', color: 'bg-red-500' },
] as const;

export async function generateQuestions(
    packName: string,
    count: number = 10,
    intensity?: number,
    tone: ToneLevel = 3,
    packDescription?: string
): Promise<GeneratedQuestion[]> {
    const openai = getOpenAI();
    const isClean = tone === 0;
    const isExplicit = tone >= 4;

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
        4: 'TONE: Spicy and bold. Adventurous sexual content with direct but not crude language. Can include kinks, fantasies, and explicit acts but described tastefully. Use terms like "oral", "bondage" etc.',
        5: 'TONE: Explicit and raw. NSFW content with graphic, direct sexual terminology. Be crude and uninhibited. Use explicit terms freely. This is adult content - do not hold back or euphemize.',
    };

    const toneInstruction = toneInstructions[tone];

    // Use different examples based on tone level
    const symmetricExamples = isClean
        ? 'GOOD: "Cook a new recipe together", "Play a board game", "Go on a hike", "Have a deep conversation about your goals".'
        : isExplicit
            ? 'GOOD: "Have sex in a public place", "Roleplay a new scenario together", "Shower together".'
            : 'GOOD: "Cook a romantic dinner together", "Stargaze and share dreams", "Give each other massages", "Dance together at home".';

    const asymmetricExamples = isClean
        ? `text (The Doer): Active command/proposal (e.g., "Teach your partner something new", "Plan a surprise activity").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Learn something new from your partner", "Be surprised with an activity").
   - GOOD: "Cook your partner their favorite meal" / "Have your partner cook your favorite meal".`
        : isExplicit
            ? `text (The Doer): Active command/proposal (e.g., "Tie your partner up", "Give your partner a massage").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Be tied up by your partner", "Receive a massage from your partner").
   - GOOD: "Spank your partner" / "Be spanked by your partner".`
            : `text (The Doer): Active command/proposal (e.g., "Write a love letter to your partner", "Plan a surprise date").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Receive a love letter from your partner", "Be surprised with a date").
   - GOOD: "Give your partner a massage" / "Receive a massage from your partner".`;

    const explicitWarning = isClean
        ? '\n\nCRITICAL: This is a CLEAN pack with NO romantic or sexual content. Focus ONLY on communication, activities, challenges, and bonding. NO romance, NO flirting, NO intimacy, NO physical affection beyond friendly gestures.'
        : isExplicit
            ? ''
            : '\n\nCRITICAL: This is a NON-EXPLICIT pack. Do NOT include any sexual acts, crude language, or NSFW content. Keep all proposals romantic, playful, or emotionally intimate without being sexually explicit.';

    const descriptionContext = packDescription
        ? `\nPack Description: "${packDescription}"\nUse this description to guide the theme and style of questions.`
        : '';

    const prompt = `Generate ${count} unique questions for a couples' intimacy question pack called "${packName}".${descriptionContext}

${INTENSITY_GUIDE_SHORT}

${intensityInstruction}
${toneInstruction}${explicitWarning}

IMPORTANT: The app uses a swipe-based interface (Like/Dislike/Maybe).
Cards should be "Proposals" relative to a specific action, rather than interview questions.

For each "question", strictly decide if it is a SYMMETRIC activity (shared) or ASYMMETRIC action (one-way).

1. SYMMETRIC Activities (Single Card):
   - Use for shared experiences where both partners do the same thing together.
   - Phrasing: Direct action proposal or simple "Would you like to...".
   - ${symmetricExamples}
   - BAD: "Have you ever thought about...", "Do you think we should...", "How about we...".
   - Structure:
     - text: The action proposal.
     - partner_text: null.

2. ASYMMETRIC Actions (Two-Part Card):
   - Use for actions where one partner does something TO the other.
   - ${asymmetricExamples}
   - BAD: "Would you like to spank me?" (Ambiguous who "me" is).

Required JSON structure:
- text: The question/proposal text (see above).
- partner_text: (optional) The partner-facing text for two-part cards.
- intensity: A number 1-5 based on the INTENSITY LEVELS guide above. Grade based on PHYSICAL INTIMACY, not language.
  Examples: "Share a dream" = 1, "Cuddle" = 2, "Massage" = 3, "Oral sex" = 4, "Have sex" = 5

Return a JSON object with a "questions" array containing these question objects.
Mix distinct symmetric and asymmetric proposals.`;

    const systemMessages: Record<ToneLevel, string> = {
        0: 'You are a content writer for a couples app focused on communication, activities, and bonding. Generate clean, non-romantic content like conversation starters, fun challenges, and activities. No romance or intimacy. Always respond with valid JSON only.',
        1: 'You are a romantic content writer for a couples relationship app. Generate sweet, wholesome content that helps couples connect emotionally. Always respond with valid JSON only.',
        2: 'You are a playful content writer for a couples relationship app. Generate fun, flirty content that helps couples have fun together. Always respond with valid JSON only.',
        3: 'You are a sensual content writer for a couples relationship app. Generate passionate, intimate content that helps couples explore their desires tastefully. Always respond with valid JSON only.',
        4: 'You are a bold content writer for an adult couples app. Generate spicy, adventurous content that helps couples explore kinks and fantasies. Always respond with valid JSON only.',
        5: 'You are an uninhibited content writer for an adult couples app. Generate raw, explicit, and direct content that explores kinks and desires. Do not filter for politeness. Always respond with valid JSON only.',
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
    const prompt = `Generate a unique category for organizing question packs in a couples' intimacy/connection app.
  
  Return a JSON object with:
  - name: Category name (1-3 words, e.g., "Romance", "Adventure", "Communication")
  - description: Brief description of what packs in this category explore (1 sentence)
  - icon: A single emoji that represents this category
  
  Be creative and think of categories that help couples explore different aspects of their relationship.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content organizer for a couples relationship app. Generate engaging category ideas. Always respond with valid JSON only.',
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
    explicit: boolean
): Promise<GeneratedCategoryIdea[]> {
    const openai = getOpenAI();
    const existingList = existingCategories.length > 0
        ? existingCategories.join(', ')
        : 'None';

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and explicitly intimate categories (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const prompt = `Here are the current categories in our couples' question app: ${existingList}.

  Suggest 5 NEW, UNIQUE category ideas that differ from the existing ones.
  ${explicitInstruction}

  Return a JSON object with an "ideas" array containing 5 objects, where each object has:
  - name: Category name (1-3 words)
  - description: Brief description of what packs in this category explore (1 sentence)
  - icon: A single descriptive emoji

  Focus on diverse topics like communications, future planning, fun, conflict resolution, intimacy, etc.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content strategist for a couples relationship app. Generate engaging, diverse category ideas. Always respond with valid JSON only.',
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
    explicit: boolean
): Promise<GeneratedPackIdea[]> {
    const openai = getOpenAI();
    const existingList = existingPacks.length > 0
        ? existingPacks.join(', ')
        : 'None';

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and uncensored pack ideas (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const prompt = `We are building question packs for the category "${categoryName}" in a couples' app.
  Existing packs in this category: ${existingList}.
  
  Suggest 5 NEW, UNIQUE pack ideas that fit this category and differ from existing ones.
  ${explicitInstruction}
  
  Return a JSON object with an "ideas" array containing 5 objects, where each object has:
  - name: Pack name (catchy, 3-6 words)
  - description: Brief description (1-2 sentences)
  - icon: A single descriptive emoji
  
  Make them engaging and specific to "${categoryName}".`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content strategist for a couples relationship app. Generate engaging pack ideas. Always respond with valid JSON only.',
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
        ? 'Do not censor yourself. If the content is already explicit, keep it that way or enhance usage of bolder terms if appropriate.'
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
- Limit ONLY if there is a clear anatomical requirement (e.g. genitalia specific).

Examples:
- "Blowjob" -> Needs penis -> Exclude F+F -> ['male+male', 'female+male']
- "Lick pussy" -> Needs vagina -> Exclude M+M -> ['female+male', 'female+female']

RULES FOR INITIATOR (target_user_genders):
- ONLY relevant for TWO-PART questions (those with partner_text set).
- Analyze the "text" field to determine who should see this card FIRST as the initiator.
- Consider WHO the action is TYPICALLY intended for, not just who CAN physically perform it.
- In M+F couples, consider the typical heterosexual context of sexual acts.
- If text implies a specific gender role, set initiator accordingly.
- If text is truly gender-neutral AND role-neutral, leave as null.

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
        ? 'TONE: This is an EXPLICIT pack. Use raw, direct, graphic language. Do NOT sanitize or euphemize explicit content. Keep crude terms like "cum", "fuck", "cock", etc. if they appear in the original.'
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
   - Use for actions where one partner does something TO the other.
   - ${asymmetricExamples}
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
        ? 'You are an uninhibited content editor for an adult couples app. You improve question phrasing to be direct, raw, and explicit while preserving the original intent. Do not censor or euphemize. Always respond with valid JSON only.'
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
