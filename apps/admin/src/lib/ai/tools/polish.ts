// =============================================================================
// Content Polish Functions
// Polish and improve content text
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';

type PolishType = 'question' | 'partner_text' | 'pack_name' | 'pack_description' | 'category_name';

/**
 * Polish and improve content text
 */
export async function polishContent(
    text: string,
    type: PolishType,
    explicit: boolean = false
): Promise<string> {
    const openai = getOpenAI();

    const explicitInstruction = explicit
        ? 'Use nuanced language: tasteful phrasing for general acts ("have sex", "perform oral") but crude/specific terms when relevant to the activity ("cum on", "cock ring", "edge"). Do not over-sanitize - keep explicit terms that are essential to the activity. NEVER change "cum" to "come" - they have different meanings.'
        : 'CRITICAL: This is a NON-EXPLICIT pack. Keep it clean, romantic, and playful. Do NOT add any sexual acts, crude language, or NSFW content. If the original text contains explicit content, replace with tasteful romantic alternatives.';

    const contextMap: Record<PolishType, string> = {
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
  "Would you want to give me a massage?" -> "Give your partner a sensual massage"
  "Have you ever thought about sex in public?" -> "Have sex somewhere you might get caught"
  "maybe we could try using a blindfold sometime" -> "Blindfold your partner and tease their senses"
  "cum on partner" -> "Cum on your partner" (keep "cum", don't change to "come")
  ` : `
  "Receive a massage from your partner" -> "Let your partner's hands work the tension from your body"
  "Get oral from your partner" -> "Let your partner pleasure you with their mouth"
  "Be tied up" -> "Let your partner tie you up and surrender control"
  "Moan for your partner" -> "Let your partner make you moan"
  `}
  === END EXAMPLES ===
  `;
    }

    const prompt = `<task>
Polish, improve, and tidy up the following text used as ${contextMap[type] || 'text in the app'}.
</task>

<original_text>
"${text}"
</original_text>

<content_type>
${explicitInstruction}
</content_type>

<rules>
${additionalRules}
- Make it concise, engaging, and grammatically correct
- Maintain the original intent and meaning
- Do NOT change the core action - only improve phrasing
</rules>

${fewShotExamples}

<output_format>
{
  "polished": string  // The improved text
}
</output_format>`;

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
        temperature: getTemperature('polish', 0.7),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.polished;
}
