// =============================================================================
// Target Analysis Functions
// Analyze questions for gender targeting and couple compatibility
// =============================================================================

import { getOpenAI, getModel } from '../client';
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

    const prompt = `Analyze the following questions for a couples app and suggest:
1. "allowed_couple_genders" (which couple types can see this question)
2. "target_user_genders" (who should see this question FIRST as initiator - only relevant for two-part questions with partner_text)

COUPLE TARGET OPTIONS: 'male+male', 'female+male', 'female+female'
INITIATOR OPTIONS: 'male', 'female', 'non-binary'

RULES FOR COUPLE TARGETS (allowed_couple_genders):
- Default to ALL (null) if the action is gender-neutral/universal (e.g. kissing, massage, generic sex, anal).
- Limit ONLY if there is a clear, explicit anatomical requirement (e.g. genitalia-specific terms).
- SEX TOYS ARE GENDER-NEUTRAL: Vibrators, dildos, plugs, etc. can be used by ANYONE. Do NOT restrict based on toys.
  - "Control your partner's vibrator" -> ALL couples, ANY initiator (vibrators work on any body)
  - "Use a butt plug" -> ALL couples (everyone has a butt)

Examples of ACTUAL restrictions:
- "Blowjob" -> Needs penis -> Exclude F+F -> ['male+male', 'female+male']
- "Lick pussy" -> Needs vagina -> Exclude M+M -> ['female+male', 'female+female']
- "Vibrator", "dildo", "toy" -> NO restriction, works for everyone

RULES FOR INITIATOR (target_user_genders):
- ONLY relevant for TWO-PART questions (those with partner_text set).
- Analyze the "text" field to determine who should see this card FIRST as the initiator.
- ONLY set initiator if there is an EXPLICIT anatomical requirement in the text.
- SEX TOYS DO NOT IMPLY GENDER: "vibrator", "dildo", "toy", "plug" -> initiator: null (anyone can use/control toys)
- If text is gender-neutral, leave as null. When in doubt, use null.

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
