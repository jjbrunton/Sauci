// =============================================================================
// Pack Generation Functions
// Generate pack names, descriptions, and pack ideas
// =============================================================================

import { getOpenAI, getModel } from '../client';
import type { GeneratedPack, GeneratedPackIdea } from '../types';

/**
 * Generate a single pack name and description
 */
export async function generatePack(
    categoryName?: string,
    explicit: boolean = false,
    crudeLang: boolean = false,
    inspiration?: string,
    previousNames?: string[]
): Promise<GeneratedPack> {
    const openai = getOpenAI();

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and uncensored themes (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const crudeLangInstruction = crudeLang
        ? 'CRUDE LANGUAGE OVERRIDE: Use crude, vulgar terms throughout - "fuck", "cock", "pussy" etc.'
        : '';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide your generation.`
        : '';

    const avoidInstruction = previousNames && previousNames.length > 0
        ? `\n\nIMPORTANT - DO NOT generate any of these pack names (already suggested): ${previousNames.join(', ')}\nGenerate something completely different and fresh.`
        : '';

    const appContext = `This is an ACTIVITY-FOCUSED app where couples swipe on activity proposals.
Each partner independently swipes Like/Dislike/Maybe, and when both swipe positively they "match".
Packs contain collections of activities to try together (date ideas, intimate experiences, adventures, challenges, etc.).
This is NOT a Q&A app - it's about discovering shared interests in activities.`;

    const prompt = categoryName
        ? `Generate a creative activity pack for a couples' intimacy/connection app in the category "${categoryName}".

       ${appContext}

       The pack should contain a themed collection of activities couples can explore together.

       ${explicitInstruction}
       ${crudeLangInstruction}${inspirationInstruction}${avoidInstruction}

       Return a JSON object with:
       - name: A catchy, engaging pack name (3-6 words) that evokes activities/experiences
       - description: A brief, enticing description (1-2 sentences) focusing on the activities in the pack

       Make it romantic, playful, and activity-focused.`
        : `Generate a creative activity pack for a couples' intimacy/connection app.

       ${appContext}

       The pack should contain a themed collection of activities couples can explore together.

       ${explicitInstruction}
       ${crudeLangInstruction}${inspirationInstruction}${avoidInstruction}

       Return a JSON object with:
       - name: A catchy, engaging pack name (3-6 words) that evokes activities/experiences
       - description: A brief, enticing description (1-2 sentences) focusing on the activities in the pack

       Make it romantic, playful, and activity-focused.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content writer for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging pack ideas that contain collections of activities couples can do together. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    return JSON.parse(content) as GeneratedPack;
}

/**
 * Generate pack ideas for a category
 */
export async function suggestPacks(
    categoryName: string,
    existingPacks: string[],
    explicit: boolean,
    crudeLang: boolean = false,
    inspiration?: string,
    previousSuggestions?: string[]
): Promise<GeneratedPackIdea[]> {
    const openai = getOpenAI();
    const existingList = existingPacks.length > 0
        ? existingPacks.join(', ')
        : 'None';

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and uncensored pack ideas (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const crudeLangInstruction = crudeLang
        ? '\nCRUDE LANGUAGE OVERRIDE: Use crude, vulgar terms in the pack names and descriptions.'
        : '';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide your pack suggestions.`
        : '';

    const avoidInstruction = previousSuggestions && previousSuggestions.length > 0
        ? `\n\nIMPORTANT - DO NOT suggest any of these pack names (already suggested): ${previousSuggestions.join(', ')}\nGenerate completely different and fresh ideas.`
        : '';

    const prompt = `We are building activity packs for the category "${categoryName}" in a couples' intimacy app.

IMPORTANT - HOW THE APP WORKS:
- This is an ACTIVITY-FOCUSED app, NOT a Q&A app
- Packs contain ACTIVITY PROPOSALS (things couples can do together)
- Each partner independently swipes Like/Dislike/Maybe on activities
- When BOTH partners swipe positively on the same activity, they "match" and can discuss it
- Activities are things like: date ideas, intimate experiences, adventures, challenges, conversations to have, etc.
- This is NOT about asking each other questions - it's about discovering shared interests in activities

PACK THEMES should focus on:
- Collections of related activities couples might want to try
- Experiences to share together
- Things to do, not questions to ask
- Date ideas, adventures, intimate moments, challenges, bonding activities

Existing packs in this category: ${existingList}.

Suggest 5 NEW, UNIQUE pack ideas that fit this category and differ from existing ones.
${explicitInstruction}${crudeLangInstruction}${inspirationInstruction}${avoidInstruction}

Return a JSON object with an "ideas" array containing 5 objects, where each object has:
- name: Pack name (catchy, 3-6 words) - should evoke activities/experiences, not questions
- description: Brief description (1-2 sentences) focusing on the activities/experiences in the pack
       - icon: An Ionicon name from this list: heart-outline, flame-outline, sparkles-outline, gift-outline, wine-outline, airplane-outline, home-outline, key-outline, flash-outline, sunny-outline, flower-outline, star-outline, dice-outline, compass-outline, bulb-outline


Make them engaging and specific to "${categoryName}".`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content strategist for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging pack ideas that contain collections of activities couples can do together. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.ideas as GeneratedPackIdea[];
}
