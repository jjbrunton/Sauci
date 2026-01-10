// =============================================================================
// Pack Generation Functions
// Generate pack names, descriptions, and pack ideas
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';
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

    // Sanitize inspiration to prevent prompt injection
    const sanitizedInspiration = inspiration
        ? inspiration
            .replace(/<[^>]*>/g, '')
            .replace(/\b(CRITICAL|PRIORITY|INSTRUCTION|OVERRIDE|IGNORE|SYSTEM|ASSISTANT)\b:?/gi, '')
            .trim()
        : '';

    const inspirationSection = sanitizedInspiration
        ? `\n<user_guidance>\n${sanitizedInspiration}\n</user_guidance>`
        : '';

    const avoidSection = previousNames && previousNames.length > 0
        ? `\n<avoid_names>\n${previousNames.join(', ')}\n</avoid_names>`
        : '';

    const prompt = `<task>
Generate a creative activity pack for a couples' intimacy/connection app${categoryName ? ` in the category "${categoryName}"` : ''}.
</task>

<app_context>
This is an ACTIVITY-FOCUSED app where couples swipe on activity proposals.
Each partner independently swipes Like/Dislike/Maybe, and when both swipe positively they "match".
Packs contain collections of activities to try together (date ideas, intimate experiences, adventures, challenges, etc.).
This is NOT a Q&A app - it's about discovering shared interests in activities.
</app_context>
${inspirationSection}

<content_guidelines>
${explicitInstruction}
${crudeLangInstruction}
</content_guidelines>
${avoidSection}

<output_format>
{
  "name": string,        // Catchy pack name, 3-6 words, evokes activities/experiences
  "description": string  // Brief, enticing description, 1-2 sentences, activity-focused
}

Make it romantic, playful, and activity-focused.
</output_format>`;

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
        temperature: getTemperature('generate', 0.8),
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

    // Sanitize inspiration to prevent prompt injection
    const sanitizedInspiration = inspiration
        ? inspiration
            .replace(/<[^>]*>/g, '')
            .replace(/\b(CRITICAL|PRIORITY|INSTRUCTION|OVERRIDE|IGNORE|SYSTEM|ASSISTANT)\b:?/gi, '')
            .trim()
        : '';

    const inspirationSection = sanitizedInspiration
        ? `\n<user_guidance>\n${sanitizedInspiration}\n</user_guidance>`
        : '';

    const avoidSection = previousSuggestions && previousSuggestions.length > 0
        ? `\n<avoid_names>\n${previousSuggestions.join(', ')}\n</avoid_names>`
        : '';

    const prompt = `<task>
Suggest 5 NEW, UNIQUE activity pack ideas for the category "${categoryName}" in a couples' intimacy app.
</task>

<app_context>
This is an ACTIVITY-FOCUSED app, NOT a Q&A app.
- Packs contain ACTIVITY PROPOSALS (things couples can do together)
- Each partner independently swipes Like/Dislike/Maybe on activities
- When BOTH partners swipe positively, they "match" and can discuss it
- Activities include: date ideas, intimate experiences, adventures, challenges, conversations
- Focus on discovering shared interests in activities, not asking questions
</app_context>
${inspirationSection}

<pack_themes>
Focus on:
- Collections of related activities couples might want to try
- Experiences to share together
- Things to do, not questions to ask
- Date ideas, adventures, intimate moments, challenges, bonding activities
</pack_themes>

<existing_packs>
Current packs in this category: ${existingList}
</existing_packs>

<content_guidelines>
${explicitInstruction}
${crudeLangInstruction}
</content_guidelines>
${avoidSection}

<output_format>
{
  "ideas": [
    {
      "name": string,        // Catchy, 3-6 words, evokes activities/experiences
      "description": string, // 1-2 sentences, activity-focused
      "icon": string         // Ionicon: heart-outline, flame-outline, sparkles-outline, gift-outline, wine-outline, airplane-outline, home-outline, key-outline, flash-outline, sunny-outline, flower-outline, star-outline, dice-outline, compass-outline, bulb-outline
    }
  ]
}

Generate 5 unique pack ideas that differ from existing ones. Make them engaging and specific to "${categoryName}".
</output_format>`;

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
        temperature: getTemperature('generate', 0.9),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.ideas as GeneratedPackIdea[];
}
