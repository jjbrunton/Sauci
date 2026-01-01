// =============================================================================
// Category Generation Functions
// Generate category names and category ideas
// =============================================================================

import { getOpenAI, getModel } from '../client';
import type { GeneratedCategoryIdea } from '../types';

/**
 * Generate a single category
 */
export async function generateCategory(): Promise<{ name: string; description: string; icon: string }> {
    const openai = getOpenAI();
    const prompt = `Generate a unique category for organizing activity packs in a couples' intimacy/connection app.

This is an ACTIVITY-FOCUSED app where couples swipe on activity proposals.
Each partner independently swipes Like/Dislike/Maybe, and when both swipe positively they "match".
Categories organize collections of activity packs (date ideas, intimate experiences, adventures, challenges, etc.).
This is NOT a Q&A app - it's about discovering shared interests in activities.

Return a JSON object with:
- name: Category name (1-3 words, e.g., "Romance", "Adventure", "Date Nights")
- description: Brief description of what activity packs in this category contain (1 sentence)
- icon: A single emoji that represents this category

Be creative and think of categories that help couples explore different types of activities together.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content organizer for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging category ideas for organizing activity packs. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    return JSON.parse(content);
}

/**
 * Suggest multiple category ideas
 */
export async function suggestCategories(
    existingCategories: string[],
    explicit: boolean,
    crudeLang: boolean = false,
    inspiration?: string,
    previousSuggestions?: string[]
): Promise<GeneratedCategoryIdea[]> {
    const openai = getOpenAI();
    const existingList = existingCategories.length > 0
        ? existingCategories.join(', ')
        : 'None';

    const explicitInstruction = explicit
        ? 'Include bold, spicy, and explicitly intimate categories (NSFW is allowed).'
        : 'Do NOT include any explicit or NSFW themes. Keep it romantic, emotional, playful, and clean.';

    const crudeLangInstruction = crudeLang
        ? '\nCRUDE LANGUAGE OVERRIDE: Use crude, vulgar terms in the names and descriptions.'
        : '';

    const inspirationInstruction = inspiration
        ? `\n\nINSPIRATION/GUIDANCE FROM ADMIN:\n${inspiration}\n\nUse the above inspiration to guide your category suggestions.`
        : '';

    const avoidInstruction = previousSuggestions && previousSuggestions.length > 0
        ? `\n\nIMPORTANT - DO NOT suggest any of these category names (already suggested): ${previousSuggestions.join(', ')}\nGenerate completely different and fresh ideas.`
        : '';

    const prompt = `Here are the current categories in our couples' activity/intimacy app: ${existingList}.

IMPORTANT - HOW THE APP WORKS:
- This is an ACTIVITY-FOCUSED app where couples swipe on activity proposals
- Each partner independently swipes Like/Dislike/Maybe on activities
- When BOTH partners swipe positively, they "match" and can discuss the activity
- Categories organize collections of activity packs (date ideas, intimate experiences, adventures, etc.)
- This is NOT a Q&A app - it's about discovering shared interests in activities to do together

Suggest 5 NEW, UNIQUE category ideas that differ from the existing ones.
${explicitInstruction}${crudeLangInstruction}${inspirationInstruction}${avoidInstruction}

Return a JSON object with an "ideas" array containing 5 objects, where each object has:
- name: Category name (1-3 words)
- description: Brief description of what activity packs in this category contain (1 sentence)
- icon: A single descriptive emoji

Focus on diverse activity themes like: date ideas, adventures, intimate experiences, bonding activities, challenges, travel, home activities, etc.`;

    const response = await openai.chat.completions.create({
        model: getModel('generate'),
        messages: [
            {
                role: 'system',
                content: 'You are a creative content strategist for a couples activity/intimacy app. The app helps couples discover shared interests by swiping on activity proposals. Generate engaging, diverse category ideas for organizing activity packs. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    const parsed = JSON.parse(content);
    return parsed.ideas as GeneratedCategoryIdea[];
}
