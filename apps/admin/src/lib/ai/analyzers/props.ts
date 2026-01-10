// =============================================================================
// Props Analysis Functions
// Identify required props/accessories for questions
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';
import type { PropsAnalysis } from '../types';

/**
 * Analyze questions for required props/accessories
 */
export async function analyzeQuestionProps(
    questions: {
        id: string;
        text: string;
        partner_text?: string | null;
        required_props?: string[] | null;
    }[],
    existingProps: string[] = []
): Promise<PropsAnalysis[]> {
    const openai = getOpenAI();

    const normalizedExistingProps = existingProps
        .map(prop => prop.trim())
        .filter(Boolean);

    const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        partner_text: q.partner_text,
        current_required_props: q.required_props ?? null,
    }));

    const prompt = `<task>
Identify any props/accessories required to perform each question.
Only include questions where required props should change (missing, incorrect, or overly generic).
</task>

<existing_props>
Prefer these exact prop names when possible (reuse existing names instead of inventing new ones):
${JSON.stringify(normalizedExistingProps)}
</existing_props>

<rules>
1. Props are physical items/accessories, not body parts or acts.
2. Use lowercase, short, singular names (e.g., "blindfold", "remote vibrator").
3. If a prop is essentially the same as an existing one, reuse the existing name.
4. Avoid making up new variants when a close existing name is available.
5. Example: if "remote vibrator" exists, map "wifi" or "app-controlled" variants to "remote vibrator".
6. Use specific items when clearly stated; otherwise allow "toy" or "props".
7. If no props are required, set suggested_required_props to null.
8. Only return entries where the suggested props differ from current_required_props.
</rules>

<questions_to_analyze>
${JSON.stringify(simplifiedQuestions)}
</questions_to_analyze>

<output_format>
{
  "analysis": [
    {
      "id": string,
      "suggested_required_props": string[]|null,
      "reason": string
    }
  ]
}
</output_format>`;

    const response = await openai.chat.completions.create({
        model: getModel('fix'),
        messages: [
            {
                role: 'system',
                content: 'You are a content analyst for a couples app. Identify required props/accessories and return valid JSON.'
            },
            { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: getTemperature('fix', 0.3),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.analysis || [];
}
