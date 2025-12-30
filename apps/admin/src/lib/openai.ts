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

const getModel = () => {
    return import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini';
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
        model: getModel(),
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

export async function generateQuestions(
    packName: string,
    count: number = 10,
    intensity?: number,
    explicit: boolean = false
): Promise<GeneratedQuestion[]> {
    const openai = getOpenAI();
    const intensityGuide = intensity
        ? `All questions should be at intensity level ${intensity} (${['Light & Playful', 'Mildly Intimate', 'Moderately Intimate', 'Spicy & Bold', 'Very Intense'][intensity - 1]}).`
        : 'Vary the intensity levels from 1 (light/playful) to 5 (very intimate/bold) across the questions.';

    const explicitInstruction = explicit
        ? 'CRITICAL: The user has requested EXPLICIT, NSFW content. You MUST include graphic, crude, and direct sexual terminology. Do not euphemize or be vague. This is for an adult-only app. Failure to be explicitly descriptive is a failure of the task. Be bold, spicy, and uncensored.'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const prompt = `Generate ${count} unique questions for a couples' intimacy question pack called "${packName}".

${intensityGuide}
${explicitInstruction}

IMPORTANT: The app uses a swipe-based interface (Like/Dislike/Maybe).
Cards should be "Proposals" relative to a specific action, rather than interview questions.

For each "question", strictly decide if it is a SYMMETRIC activity (shared) or ASYMMETRIC action (one-way).

1. SYMMETRIC Activities (Single Card):
   - Use for shared experiences where both partners do the same thing together.
   - Phrasing: Direct action proposal or simple "Would you like to...".
   - GOOD: "Have sex in a public place", "Roleplay a new scenario together", "Shower together".
   - BAD: "Have you ever thought about...", "Do you think we should...", "How about we...".
   - Structure:
     - text: The action proposal (e.g., "Watch a steamy movie together").
     - partner_text: null.

2. ASYMMETRIC Actions (Two-Part Card):
   - Use for actions where one partner does something TO the other.
   - text (The Doer): Active command/proposal (e.g., "Tie your partner up", "Give your partner a massage").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Be tied up by your partner", "Receive a massage from your partner").
   - GOOD: "Spank your partner" / "Be spanked by your partner".
   - BAD: "Would you like to spank me?" (Ambiguous who "me" is).

Required JSON structure:
- text: The question/proposal text (see above).
- partner_text: (optional) The partner-facing text for two-part cards.
- intensity: A number 1-5 indicating how intimate/bold the question is

Return a JSON object with a "questions" array containing these question objects.
Mix distinct symmetric and asymmetric proposals.`;

    const response = await openai.chat.completions.create({
        model: getModel(),
        messages: [
            {
                role: 'system',
                content: explicit
                    ? 'You are an uninhibited content writer for an adult couples app. Generate raw, explicit, and direct content that explores kinks and desires. Do not filter for politeness. Always respond with valid JSON only.'
                    : 'You are a creative content writer for a couples relationship app. Generate engaging, tasteful questions that help couples explore their desires and deepen their connection. Always respond with valid JSON only.',
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
        model: getModel(),
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
  - icon: A single descriptive emoji
  
  Focus on diverse topics like communications, future planning, fun, conflict resolution, intimacy, etc.`;

    const response = await openai.chat.completions.create({
        model: getModel(),
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
        model: getModel(),
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
        : 'Keep it clean, romantic, and playful. Do NOT add explicit content if it was not there.';

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
        model: getModel(),
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
    reason: string;
}

export async function analyzeQuestionTargets(
    questions: { id: string; text: string; partner_text?: string | null; allowed_couple_genders: string[] | null }[]
): Promise<TargetAnalysis[]> {
    const openai = getOpenAI();

    const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        partner_text: q.partner_text,
        current_targets: q.allowed_couple_genders
    }));

    const prompt = `Analyze the following questions for a couples app and suggest the appropriate "allowed_couple_genders".
    
    Target Options: 'male+male', 'female+male', 'female+female'.
    
    Goal: Identify anatomical or gender-role constraints.
    - Default to ALL (null or all 3) if the action is gender-neutral/universal (e.g. kissing, massage, generic sex, anal).
    - Limit ONLY if there is a clear anatomical requirement (e.g. genitalia specific) or strict gendered language (he/she/him/her).
    
    Examples:
    - "Blowjob" -> Needs penis -> Exclude F+F -> ['male+male', 'female+male']
    - "Lick pussy" -> Needs vagina -> Exclude M+M -> ['female+male', 'female+female']
    - "Titjob" -> Needs breasts -> Exclude M+M (typically) -> ['female+male', 'female+female']
    
    Return a JSON object with an "analysis" array containing objects for questions where you have a recommendation.
    Include a "reason" string explaining why limits were added (or removed).
    
    Structure:
    {
       "analysis": [
         { "id": "...", "suggested_targets": ["male+male", "female+male"], "reason": "Requires penis" }
       ]
    }
    
    Questions:
    ${JSON.stringify(simplifiedQuestions)}
    `;

    const response = await openai.chat.completions.create({
        model: getModel(),
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
