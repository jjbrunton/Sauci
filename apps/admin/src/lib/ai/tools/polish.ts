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
        ? 'LEGACY EXPLICIT FLAG: It does not override the universal catalogue safety ceiling. Remove named or described sexual acts, explicit anatomy, nudity for stimulation, sex toys, fetishes, BDSM acts, arousal, orgasm, and public sexual activity. If preserving the original action would violate this rule, return a safe high-level relationship proposal instead.'
        : 'Keep it romantic, playful, and suggestive without naming or describing sexual content. If the original text is explicit, return a safe high-level relationship proposal instead.';

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
  2. ACCURACY: Preserve the original relationship intent when it is catalogue-safe.
     - "Want a candlelit dinner?" -> "Have a candlelit dinner with your partner"
     - If the core action is explicit, replace it with a high-level proposal about curiosity, trust, anticipation, or relationship dynamics.
  3. TONE: Engaging, romantic, flirty, or daring, but never sexual or instructional.
  4. UNIVERSAL SAFETY CEILING: Do not name or describe sexual acts, explicit anatomy, nudity for stimulation, sex toys, fetishes, BDSM acts, arousal, orgasm, or public sexual activity.
  `;
        fewShotExamples = `
  === FEW-SHOT EXAMPLES ===
  ${type === 'question' ? `
  "Would you want to give me a massage?" -> "Give your partner a relaxing massage"
  "Have you ever thought about trying something daring?" -> "Try something daring with your partner"
  "maybe we could explore a new dynamic sometime" -> "Explore a new dynamic with your partner"
  "describe a private fantasy" -> "Share a private desire in your own words"
  ` : `
  "Receive a massage from your partner" -> "Let your partner's hands work the tension from your body"
  "Let your partner plan the evening" -> "Let your partner take the lead for an evening"
  "Try something new together" -> "Explore a new dynamic with your partner"
  "Tell your partner what you want" -> "Share a private desire in your own words"
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
- Preserve the original intent only when it stays inside the universal safety ceiling
- Replace explicit core actions with safe, high-level relationship proposals
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
                content: 'You are a professional editor for a couples connection app. Never output sexual acts, explicit anatomy, nudity for stimulation, sex toys, fetishes, BDSM acts, arousal, orgasm, or public sexual activity. Always respond with valid JSON only.',
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
