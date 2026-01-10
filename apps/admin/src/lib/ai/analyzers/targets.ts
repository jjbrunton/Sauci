// =============================================================================
// Target Analysis Functions
// Analyze questions for gender targeting and couple compatibility
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';
import type { TargetAnalysis } from '../types';

/**
 * Analyze questions for gender targeting suggestions
 */
export async function analyzeQuestionTargets(
    questions: {
        id: string;
        text: string;
        partner_text?: string | null;
        allowed_couple_genders: string[] | null;
        target_user_genders: string[] | null;
    }[]
): Promise<TargetAnalysis[]> {
    const openai = getOpenAI();

    const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        partner_text: q.partner_text,
        current_targets: q.allowed_couple_genders,
        current_initiator: q.target_user_genders
    }));

    const prompt = `<task>
Analyze questions for couple targeting and initiator targeting.
Only include questions where you have a recommendation to change current settings.
</task>

<targeting_options>
Couple targets (allowed_couple_genders): 'male+male', 'female+male', 'female+female'
Initiator targets (target_user_genders): 'male', 'female', 'non-binary'
</targeting_options>

<couple_targeting_rules>
DEFAULT: null (ALL couples) unless explicit anatomical requirement

Restrict ONLY when:
- Activity requires penis -> ['male+male', 'female+male'] (exclude F+F)
- Activity requires vagina -> ['female+male', 'female+female'] (exclude M+M)

SEX TOYS ARE GENDER-NEUTRAL:
- Vibrators, dildos, plugs work on ANYONE -> null (no restriction)
- "Control your partner's vibrator" -> null
- "Use a butt plug" -> null (everyone has a butt)

Examples:
- "Blowjob" -> needs penis -> ['male+male', 'female+male']
- "Lick pussy" -> needs vagina -> ['female+male', 'female+female']
- "Use a toy" -> gender-neutral -> null
</couple_targeting_rules>

<initiator_targeting_rules>
ONLY for asymmetric questions (those with partner_text).
DEFAULT: null (anyone can initiate)

Set initiator ONLY when "text" field has explicit anatomical requirement:
- "Swallow your partner's cum" -> partner has penis -> initiator: ['female'] in M+F
- "Lick my cum off your body" -> "my cum" = initiator has penis -> ['male']
- "Deep throat your partner" -> partner has penis -> ['female'] in M+F
- "Give your partner a massage" -> gender-neutral -> null
- "Let her ride you" -> "her" implies female partner -> ['male']
- Sex toys -> null (anyone can use/control toys)

When in doubt, use null.
</initiator_targeting_rules>

<questions_to_analyze>
${JSON.stringify(simplifiedQuestions)}
</questions_to_analyze>

<output_format>
{
  "analysis": [
    {
      "id": string,
      "suggested_targets": string[]|null,    // e.g., ["male+male", "female+male"] or null
      "suggested_initiator": string[]|null,  // e.g., ["male"] or null
      "reason": string                       // Explanation of recommendation
    }
  ]
}

Only include questions where targeting should change.
</output_format>`;

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
        temperature: getTemperature('fix', 0.5),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.analysis || [];
}
