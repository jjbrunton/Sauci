// =============================================================================
// Question Generation Functions
// Generate questions for packs with various tone settings
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';
import { TONE_INSTRUCTIONS, SYSTEM_MESSAGES, CORE_LANGUAGE_RULES } from '../config';
import type { GeneratedQuestion, ToneLevel } from '../types';

/**
 * Build the question generation prompt
 */
function buildQuestionPrompt(
    packName: string,
    count: number,
    tone: ToneLevel,
    packDescription?: string,
    existingQuestions?: string[],
    crudeLang: boolean = false,
    inspiration?: string
): string {
    const isExplicit = tone >= 4;

    const crudeLangInstruction = crudeLang
        ? '\n\nCRUDE LANGUAGE OVERRIDE: Ignore nuanced language rules. Use crude, vulgar terms throughout - "fuck" instead of "have sex", "suck cock" instead of "perform oral", etc. Be raw and direct like uncensored sexting.'
        : '';

    // Sanitize inspiration to prevent prompt injection (remove XML-like tags and authority phrases)
    const sanitizedInspiration = inspiration
        ? inspiration
            .replace(/<[^>]*>/g, '') // Remove XML-like tags
            .replace(/\b(CRITICAL|PRIORITY|INSTRUCTION|OVERRIDE|IGNORE|SYSTEM|ASSISTANT)\b:?/gi, '') // Remove authority words
            .trim()
        : '';

    const inspirationInstruction = sanitizedInspiration
        ? `\n\n<user_guidance>\n${sanitizedInspiration}\n</user_guidance>\n\nIncorporate the user guidance above into your generation where appropriate. Use it to inform the theme and style of questions.`
        : '';

    const toneInstruction = TONE_INSTRUCTIONS[tone];

    // Examples based on tone level
    const symmetricExamples = tone <= 2
        ? 'GOOD: "Cook a new recipe together", "Take a walk holding hands", "Slow dance in the living room", "Sensual massage".'
        : isExplicit
            ? 'GOOD: "Sex in different positions", "Light bondage", "Anal play with toys", "Record intimate moments".'
            : 'GOOD: "Mutual masturbation", "Oral sex", "Light roleplay", "Using basic toys together".';

    const asymmetricExamples = tone <= 2
        ? `Examples:
   - text: "Cook your partner their favorite meal" → partner_text: "Have your partner cook your favorite meal"
   - text: "Give your partner a massage" → partner_text: "Receive a massage from your partner"
   - text: "Plan a surprise for your partner" → partner_text: "Be surprised by your partner"`
        : isExplicit
            ? `Examples:
   - text: "Tie your partner up" → partner_text: "Get tied up by your partner"
   - text: "Spank your partner" → partner_text: "Get spanked by your partner"
   - text: "Use a toy on your partner" → partner_text: "Have a toy used on you"`
            : `Examples:
   - text: "Perform oral on your partner" → partner_text: "Receive oral from your partner"
   - text: "Tease your partner" → partner_text: "Be teased by your partner"
   - text: "Undress your partner" → partner_text: "Be undressed by your partner"`;

    const explicitWarning = tone === 1
        ? '\n\nCRITICAL: This is a GENTLE pack. Focus on emotional connection and non-sexual bonding. NO explicit sexual acts.'
        : isExplicit
            ? ''
            : '\n\nCRITICAL: Avoid extreme kinks or hardcore content unless specifically requested.';

    const descriptionContext = packDescription
        ? `\nPack Description: "${packDescription}"\nUse this description to guide the theme and style of questions.`
        : '';

    const existingQuestionsContext = existingQuestions && existingQuestions.length > 0
        ? `\n\nEXISTING QUESTIONS IN THIS PACK (DO NOT DUPLICATE OR CREATE SIMILAR VARIATIONS):
${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

CRITICAL: Generate completely NEW and DIFFERENT questions. Do not repeat any of the above questions or create minor variations of them. Each new question must offer a genuinely distinct activity or experience.`
        : '';

    return `<task>
Generate ${count} unique questions for a couples' intimacy question pack called "${packName}".
</task>
${descriptionContext}${inspirationInstruction}${existingQuestionsContext}

<instructions>
${toneInstruction}${explicitWarning}${crudeLangInstruction}
</instructions>

${CORE_LANGUAGE_RULES}

<examples>
GOOD language: "Send your partner a photo", "Spank your partner", "Give your partner..."
BAD language: "Send me a photo" (who is "me"?), "Let me spank you", "I want you to..."
The card reader is the DOER. Their partner is "your partner".
</examples>

<question_types>
1. SYMMETRIC Activities (partner_text = null, no inverse_pair_id):
   - Both partners do the same thing together
   - ${symmetricExamples}

2. ASYMMETRIC Actions (requires partner_text AND inverse pair):
   - One partner does something TO/FOR the other, or roles differ
   - text = what the INITIATOR does
   - partner_text = what the RECEIVER does/experiences
   - ${asymmetricExamples}
   - CRITICAL: Every asymmetric question MUST have its inverse created as a separate question
</question_types>

<inverse_pairs>
For EVERY asymmetric question, you MUST create its inverse as a separate question.
Both questions in a pair should have the SAME inverse_pair_id (a unique string per pair).

Example pair (same inverse_pair_id "pair_1"):
  Question 1 (primary):
    text: "Spank your partner"
    partner_text: "Be spanked by your partner"
    inverse_pair_id: "pair_1"

  Question 2 (inverse):
    text: "Be spanked by your partner"
    partner_text: "Spank your partner"
    inverse_pair_id: "pair_1"

The first question in each pair (lower array index) becomes the "primary" and the second gets linked as its inverse.
Use simple pair IDs like "pair_1", "pair_2", etc.
Symmetric questions should have inverse_pair_id: null.
</inverse_pairs>

<output_format>
Return a JSON object with this exact structure:
{
  "questions": [
    {
      "text": string,              // REQUIRED: 5-12 words, doer's perspective using "your partner"
      "partner_text": string|null, // REQUIRED for asymmetric, null for symmetric
      "requires_props": string[]|null,  // Optional: items needed (e.g., ["blindfold", "massage oil"])
      "inverse_pair_id": string|null,   // REQUIRED for asymmetric pairs, null for symmetric
      "location_type": "home"|"public"|"outdoors"|"travel"|"anywhere",  // Optional
      "effort_level": "spontaneous"|"low"|"medium"|"planned"            // Optional
    }
  ]
}
</output_format>`;
}

/**
 * Generate questions using the default generation model
 */
export async function generateQuestions(
    packName: string,
    count: number = 10,
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
        temperature: getTemperature('generate', 0.9),
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
    tone: ToneLevel,
    packDescription: string | undefined,
    existingQuestions: string[] | undefined,
    crudeLang: boolean,
    inspiration: string | undefined,
    temperature?: number
): Promise<GeneratedQuestion[]> {
    const openai = getOpenAI();

    const prompt = buildQuestionPrompt(
        packName,
        count,
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
        temperature: temperature ?? getTemperature('generate', 0.9),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.questions as GeneratedQuestion[];
}
