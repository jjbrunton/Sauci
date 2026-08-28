// =============================================================================
// Text Analysis Functions
// Analyze and suggest improvements for question text
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';
import type { TextAnalysis } from '../types';

/**
 * Analyze question text and suggest improvements
 */
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
        ? 'LEGACY EXPLICIT FLAG: It does not override the universal catalogue safety ceiling. Replace explicit wording with a high-level proposal about curiosity, trust, anticipation, comfort, or relationship dynamics. If that would invent a materially different proposal, omit it so deletion review can archive it.'
        : 'Keep language romantic, playful, flirty, or daring without naming or describing sexual content. Replace explicit wording with a safe high-level proposal, or omit it when that would change the proposal materially.';

    const symmetricExamples = isExplicit
        ? 'GOOD SAFE REPLACEMENTS: "Explore a new dynamic together", "Share a private desire in your own words", "Try something daring together"'
        : 'GOOD: "Cook a romantic dinner together", "Stargaze and share your dreams", "Give each other massages", "Dance together at home"';

    const asymmetricExamples = isExplicit
        ? `text (The Doer): Active safe proposal (e.g., "Let your partner take the lead").
   - partner_text (The Receiver): Reciprocal safe proposal (e.g., "Take the lead with your partner").
   - GOOD: "Plan a bold surprise for your partner" / "Let your partner plan a bold surprise"`
        : `text (The Doer): Active command/proposal (e.g., "Write a love letter to your partner", "Plan a surprise date for your partner").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Receive a love letter from your partner", "Be surprised with a date by your partner").
   - GOOD: "Give your partner a massage" / "Receive a massage from your partner"`;

    const prompt = `<task>
Analyze the following questions and suggest improved text that follows our style guidelines.
Only include questions that NEED improvement - skip well-phrased ones.
</task>

<content_type>
${toneInstruction}
</content_type>

<app_context>
The app uses a swipe-based interface (Like/Dislike/Maybe).
Cards should be "Proposals" for specific actions, NOT interview questions.
</app_context>

<question_types>
1. SYMMETRIC Activities (partner_text = null):
   - Both partners do the same thing together
   - ${symmetricExamples}
   - BAD: "Have you ever thought about...", "Do you think we should..."

2. ASYMMETRIC Actions (needs both text AND partner_text):
   - One partner does something TO/FOR the other
   - text = what the INITIATOR does
   - partner_text = what the RECEIVER experiences
   - ${asymmetricExamples}

   Partner text rules:
   - Describe RECEIVER's experience clearly
   - Keep both perspectives inside the same universal safety ceiling
</question_types>

<rules>
1. Preserve the core relationship intent only when it is catalogue-safe
2. Keep SHORT and DIRECT - aim for 5-12 words, no parentheticals
3. Remove wishy-washy: "Would you want to...", "Have you ever...", "Do you think..."
4. Use "your partner" instead of "me", "you", "him", "her"
5. Keep allowed catalogue proposals anatomy-neutral by default
6. Make partner_text APPEALING - don't just grammatically flip, make receiver feel excited
7. FLAG CLICHES: "candlelit dinner", "rose petals", "bubble bath", "Netflix and chill"
8. Skip questions that are ALREADY well-phrased
</rules>

<questions_to_analyze>
${JSON.stringify(simplifiedQuestions)}
</questions_to_analyze>

<output_format>
{
  "suggestions": [
    {
      "id": string,                    // Question ID
      "suggested_text": string,        // Improved text (short, direct)
      "suggested_partner_text": string|null,  // Improved partner_text or null if symmetric
      "reason": string                 // Brief explanation of text improvement
    }
  ]
}

Only include questions that need text improvement.
</output_format>`;

    const systemMessage = isExplicit
        ? 'You are a content editor for a couples connection app. A legacy explicit flag never overrides the universal safety ceiling. Never output sexual acts, explicit anatomy, nudity for stimulation, sex toys, fetishes, BDSM acts, arousal, orgasm, or public sexual activity. Always respond with valid JSON only.'
        : 'You are a professional content editor for a couples connection app. Improve phrasing while never outputting sexual acts, explicit anatomy, nudity for stimulation, sex toys, fetishes, BDSM acts, arousal, orgasm, or public sexual activity. Always respond with valid JSON only.';

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
        temperature: getTemperature('fix', 0.5),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.suggestions || [];
}
