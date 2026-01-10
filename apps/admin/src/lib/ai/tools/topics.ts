// =============================================================================
// Topic Extraction Functions
// Extract topics from packs for categorization
// =============================================================================

import { getOpenAI, getModel, getTemperature } from '../client';
import type { TopicExtractionResult } from '../types';

/**
 * Extract topics from a pack based on its name, description, and questions
 */
export async function extractTopicsFromPack(
    packName: string,
    packDescription: string | null,
    questions: string[],
    existingTopics: { id: string; name: string }[]
): Promise<TopicExtractionResult> {
    const openai = getOpenAI();

    const existingTopicNames = existingTopics.map(t => t.name);
    const existingTopicsJson = JSON.stringify(existingTopics);

    const prompt = `<task>
Analyze the question pack and extract relevant topics/kinks/interests that describe its content.
</task>

<pack_info>
Pack Name: "${packName}"
${packDescription ? `Pack Description: "${packDescription}"` : ''}
</pack_info>

<questions>
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
</questions>

<existing_topics>
Available topics (prefer matching these): ${existingTopicNames.length > 0 ? existingTopicNames.join(', ') : 'None yet'}

Topic IDs: ${existingTopicsJson}
</existing_topics>

<instructions>
1. Identify 1-5 topics that best describe this pack's content
2. Topics should be specific kinks, interests, or themes
   - Examples: Bondage, Exhibitionism, Voyeurism, Role Play, Sensory Play, Oral, Anal, Communication, Romance, Adventure
3. ALWAYS prefer matching an existing topic - use the EXACT name and include existingTopicId
4. Only suggest a new topic if nothing in existing list is appropriate
5. Topic names: Title Case (e.g., "Bondage" not "bondage")
6. Keep topics broad enough to be reusable across multiple packs
</instructions>

<output_format>
{
  "topics": [
    {
      "name": string,           // Topic name (use exact existing name if matching)
      "isNew": boolean,         // false if matching existing, true if new
      "existingTopicId": string|null  // ID from existing topics if isNew is false
    }
  ],
  "reasoning": string           // Brief explanation of why these topics were chosen
}
</output_format>`;

    const response = await openai.chat.completions.create({
        model: getModel('fix'),
        messages: [
            {
                role: 'system',
                content: 'You are a content categorization expert for a couples intimacy app. You analyze question packs and identify relevant topics, kinks, and themes. Always prefer matching existing topics when possible. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: getTemperature('fix', 0.3),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content generated');

    return JSON.parse(content) as TopicExtractionResult;
}
