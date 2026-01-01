// =============================================================================
// Question Generation Functions
// Generate questions for packs with various tone/intensity settings
// =============================================================================

import { getOpenAI, getModel } from '../client';
import { INTENSITY_GUIDE_SHORT, TONE_INSTRUCTIONS, SYSTEM_MESSAGES } from '../config';
import type { GeneratedQuestion, ToneLevel } from '../types';

/**
 * Build the question generation prompt
 */
function buildQuestionPrompt(
    packName: string,
    count: number,
    intensity: number | undefined,
    tone: ToneLevel,
    packDescription?: string,
    existingQuestions?: string[],
    crudeLang: boolean = false,
    inspiration?: string
): string {
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

    const toneInstruction = TONE_INSTRUCTIONS[tone];

    // Examples based on tone level
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

    return `Generate ${count} unique questions for a couples' intimacy question pack called "${packName}".${descriptionContext}${existingQuestionsContext}

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
}

/**
 * Generate questions using the default generation model
 */
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

    const prompt = buildQuestionPrompt(
        packName,
        count,
        intensity,
        tone,
        packDescription,
        existingQuestions,
        crudeLang,
        inspiration
    );

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: SYSTEM_MESSAGES[tone],
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
 * Generate questions using a specific model
 * Used by council generation for parallel model comparison
 */
export async function generateQuestionsWithModel(
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

    const prompt = buildQuestionPrompt(
        packName,
        count,
        intensity,
        tone,
        packDescription,
        existingQuestions,
        crudeLang,
        inspiration
    );

    const response = await openai.chat.completions.create({
        model: model,
        messages: [
            {
                role: 'system',
                content: SYSTEM_MESSAGES[tone],
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
