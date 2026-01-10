// =============================================================================
// Deletion Analysis Functions
// Suggest removals for low-quality or duplicate questions
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';
import type { DeletionAnalysis } from '../types';

/**
 * Analyze questions and suggest deletions (duplicates, unsafe, etc.)
 */
export async function analyzeQuestionDeletions(
    questions: { id: string; text: string; partner_text?: string | null; intensity?: number }[],
    isExplicit: boolean = false
): Promise<DeletionAnalysis[]> {
    const openai = getOpenAI();

    const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        partner_text: q.partner_text,
        intensity: q.intensity,
    }));

    const toneInstruction = isExplicit
        ? 'CONTENT: EXPLICIT pack. Adult content is allowed but must be consensual, safe, and clear. Avoid coercion, minors, illegal acts, or unsafe suggestions.'
        : 'CONTENT: NON-EXPLICIT pack. Do NOT include explicit sexual acts, crude language, or NSFW content. If the core action is sexual, it should be removed, not rewritten.';

    const prompt = `<task>
Identify questions that should be DELETED instead of edited.
Only include questions that are better removed than fixed.
</task>

<content_type>
${toneInstruction}
</content_type>

<deletion_categories>
- duplicate: same core action AND same initiator as another question (near-duplicate). Note: swapped perspectives (e.g., "give" vs "receive") are NOT duplicates.
- redundant: minor variation with no added value
- off-tone: violates explicit vs non-explicit rules
- unsafe: coercion, minors, illegal acts, or consent violations
- too-vague: not actionable or not a clear proposal
- broken: grammar/structure too broken to repair without inventing content
- off-topic: not relevant to a couples intimacy app
</deletion_categories>

<rules>
1. Prefer edits over deletions when possible.
2. Duplicates: delete the weaker/less specific version and keep the clearer one.
3. If duplicate, set duplicate_of_id to the kept question's id.
4. Do NOT delete for minor wording issues or intensity mismatches.
5. IMPORTANT: Asymmetric versions of the same activity are NOT duplicates. If one question has text="Do X to your partner" and another has text="Let your partner do X to you", these are DIFFERENT questions because they have different initiators. Only flag as duplicate if both questions have the SAME initiator doing the SAME action.
</rules>

<questions_to_analyze>
${JSON.stringify(simplifiedQuestions)}
</questions_to_analyze>

<output_format>
{
  "deletions": [
    {
      "id": string,
      "category": "duplicate"|"redundant"|"off-tone"|"unsafe"|"too-vague"|"broken"|"off-topic",
      "reason": string,
      "duplicate_of_id": string|null
    }
  ]
}

Only return questions that should be deleted.
</output_format>`;

    const systemMessage = isExplicit
        ? 'You are a strict content quality reviewer for an adult couples app. Remove only what should be deleted. Always respond with valid JSON only.'
        : 'You are a strict content quality reviewer for a couples app. Remove only what should be deleted. Always respond with valid JSON only.';

    const response = await openai.chat.completions.create({
        model: getModel('fix'),
        messages: [
            {
                role: 'system',
                content: systemMessage,
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: getTemperature('fix', 0.2),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonContent);
    return parsed.deletions || [];
}
