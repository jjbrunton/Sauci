// =============================================================================
// Text Analysis Functions
// Analyze and suggest improvements for question text
// =============================================================================

import { getOpenAI, getModel } from '../client';
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

    const prompt = `Analyze the following questions for a couples app and suggest improved text that follows our style guidelines.

${toneInstruction}

The app uses a swipe-based interface (Like/Dislike/Maybe).
Cards should be "Proposals" relative to a specific action, NOT interview questions.

For each question, decide if it is a SYMMETRIC activity (shared) or ASYMMETRIC action (one-way).

1. SYMMETRIC Activities (Single Card - partner_text should be null):
   - Use for shared experiences where both partners do the same thing together.
   - Phrasing: Direct action proposal.
   - ${symmetricExamples}
   - BAD: "Have you ever thought about...", "Do you think we should...", "How about we..."

2. ASYMMETRIC Actions (Two-Part Card - needs both text and partner_text):
   - Use for actions where one partner does something TO/FOR the other, or where roles differ.
   - text = what the INITIATOR does (their action/perspective)
   - partner_text = what the RECEIVER does/experiences (their action/perspective)
   - ${asymmetricExamples}
   - IMPORTANT: partner_text should describe the RECEIVER's experience clearly:
     - text: "Send your partner to the bathroom and follow a minute later"
     - partner_text: "Go to the bathroom and wait for your partner to join you" (NOT "Wait for your partner to follow you")
   - When initiator CAUSES a response (moan, cum, beg, etc.), partner_text should frame as ALLOWING/RECEIVING:
     - text: "Make your partner moan in public" -> partner_text: "Let your partner make you moan in public"
     - NOT: "Moan for your partner in public" (sounds like deliberate performance, not natural response)
   - BAD: "Would you like to...?" (Ambiguous who "me" is)

CRITICAL RULES:
1. PRESERVE THE CORE ACTION - Do NOT change what the question is about. Only improve phrasing.
2. Keep text SHORT and DIRECT - no explanatory parentheticals. Aim for 5-12 words.
3. Remove wishy-washy language: "Would you want to...", "Have you ever...", "Do you think...", "...fantasy"
4. Make it direct and actionable.
5. For asymmetric cards, ensure text is initiator-focused and partner_text is receiver-focused.
6. Use "your partner" instead of "me", "you", "him", "her" to keep it gender-neutral.
7. If a question is ALREADY well-phrased, do NOT include it in the results.
8. NEVER add explanatory text in parentheses - keep the proposal clean and simple.
9. NEVER MIX ANATOMICALLY INCOMPATIBLE ACTIVITIES - Do NOT combine male-specific and female-specific acts as alternatives in the same question.
10. MAKE PARTNER_TEXT APPEALING - Don't just grammatically flip the text. Make the receiver feel excited.
11. FLAG CLICHES for improvement - "candlelit dinner", "rose petals", "bubble bath", "Netflix and chill" are overused

Return a JSON object with a "suggestions" array containing ONLY questions that need improvement.
Each object should have:
- id: The question ID
- suggested_text: The improved text (short, direct, no parentheticals)
- suggested_partner_text: The improved partner_text (or null if symmetric)
- reason: Brief explanation of what was improved

Questions:
${JSON.stringify(simplifiedQuestions)}`;

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
        temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.suggestions || [];
}
