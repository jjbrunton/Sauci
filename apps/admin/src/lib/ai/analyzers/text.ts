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
    questions: { id: string; text: string; partner_text?: string | null; intensity?: number }[],
    isExplicit: boolean = false
): Promise<TextAnalysis[]> {
    const openai = getOpenAI();

    const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        partner_text: q.partner_text,
        intensity: q.intensity,
    }));

    const toneInstruction = isExplicit
        ? 'TONE: This is an EXPLICIT pack with NUANCED language. Use tasteful phrasing for common acts: "Have sex in X" (not "fuck in X"), "Perform oral" or "go down on" (not crude oral terms). BUT keep crude/specific terms when they ARE the activity: "Cum on your partner\'s tits" (cum is the act), "Use a cock ring" (that\'s the name), "Edge until they beg". The rule: crude terms for specific acts/objects, tasteful terms for general sex/oral. NEVER sanitize "cum" to "come" - they have different meanings.'
        : 'TONE: This is a NON-EXPLICIT pack. CRITICAL: Do NOT include any sexual acts, crude language, or NSFW content. Keep language romantic, sensual, or playful without crude/graphic terms. If explicit sexual content appears, replace with tasteful romantic alternatives or flag for removal.';

    // Use different examples based on explicit/non-explicit
    const symmetricExamples = isExplicit
        ? 'GOOD: "Have sex in a public place", "Roleplay a new scenario together", "Shower together", "Have a threesome"'
        : 'GOOD: "Cook a romantic dinner together", "Stargaze and share your dreams", "Give each other massages", "Dance together at home"';

    const asymmetricExamples = isExplicit
        ? `text (The Doer): Active command/proposal (e.g., "Tie your partner up", "Give your partner a massage").
   - partner_text (The Receiver): Passive/Receiving proposal (e.g., "Be tied up by your partner", "Receive a massage from your partner").
   - GOOD: "Spank your partner" / "Be spanked by your partner"`
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
   - When initiator CAUSES a response (moan, cum, beg), frame as ALLOWING:
     * text: "Make your partner moan" -> partner_text: "Let your partner make you moan"
     * NOT: "Moan for your partner" (sounds forced, not natural)
</question_types>

<rules>
1. PRESERVE THE CORE ACTION - only improve phrasing, don't change what it's about
2. Keep SHORT and DIRECT - aim for 5-12 words, no parentheticals
3. Remove wishy-washy: "Would you want to...", "Have you ever...", "Do you think..."
4. Use "your partner" instead of "me", "you", "him", "her"
5. NEVER mix anatomically incompatible activities in same question
6. Make partner_text APPEALING - don't just grammatically flip, make receiver feel excited
7. FLAG CLICHES: "candlelit dinner", "rose petals", "bubble bath", "Netflix and chill"
8. Skip questions that are ALREADY well-phrased
</rules>

<intensity_guide>
Check if current intensity matches the activity:
1 (Gentle): Emotional bonding, non-sexual (cooking, cuddling, foot massage)
2 (Warm): Romantic, affectionate touch (slow dance, sensual massage, kissing)
3 (Playful): Light sexual exploration (oral, mutual masturbation, light roleplay)
4 (Steamy): Explicit sex, moderate adventure (intercourse, light bondage, anal play)
5 (Intense): Advanced/BDSM/extreme (impact play, power dynamics, taboo kinks)

If intensity seems wrong, include suggested_intensity and intensity_reason.
</intensity_guide>

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
      "reason": string,                // Brief explanation of text improvement
      "suggested_intensity": number|null,  // 1-5 if intensity seems wrong, null if correct
      "intensity_reason": string|null      // Why intensity should change (if applicable)
    }
  ]
}

Only include questions that need text improvement OR intensity adjustment.
</output_format>`;

    const systemMessage = isExplicit
        ? 'You are an adult content editor for a couples intimacy app. Use nuanced language: tasteful phrasing for general acts (have sex, perform oral) but crude specific terms when relevant (cum, cock ring, etc). Preserve original intent. Always respond with valid JSON only.'
        : 'You are a professional content editor for a couples app. You improve question phrasing to be direct, actionable, and engaging while preserving the original intent. Always respond with valid JSON only.';

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
