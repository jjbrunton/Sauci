import { getOpenAI, getModel, getTemperature } from '../client';

export interface ImageSafetyAnalysis {
    category: 'SAFE' | 'ADULT_CONTENT' | 'VIOLENCE' | 'MINORS' | 'ILLEGAL' | 'UNCERTAIN';
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    description: string;
    concerns: string[];
    isAppropriate: boolean;
}

const SAFETY_ANALYSIS_PROMPT = `<task>
Analyze this image for content safety in the context of an adult couples intimacy app.
</task>

<context>
This app is for ADULT couples (25-45) to explore intimacy. Adult content between consenting adults is expected and acceptable. The concern is inappropriate content like violence, minors, or illegal activity.
</context>

<categories>
- SAFE: No concerns, appropriate for the app (including tasteful adult content between adults)
- ADULT_CONTENT: Explicit content - acceptable for this app but flag for review
- VIOLENCE: Gore, weapons, abuse, non-consensual acts
- MINORS: Anyone appearing under 18 years old - CRITICAL, never acceptable
- ILLEGAL: Drug use, criminal activity, non-consensual content
- UNCERTAIN: Cannot determine, needs human review
</categories>

<severity_levels>
- none: No safety concerns at all
- low: Minor flag, likely fine but worth noting
- medium: Should be reviewed by admin
- high: Likely inappropriate, requires immediate review
- critical: Definitely inappropriate, should be blocked (MINORS, VIOLENCE, ILLEGAL)
</severity_levels>

<output_format>
Return a JSON object:
{
  "category": "SAFE"|"ADULT_CONTENT"|"VIOLENCE"|"MINORS"|"ILLEGAL"|"UNCERTAIN",
  "severity": "none"|"low"|"medium"|"high"|"critical",
  "description": "Brief factual description of what's shown (max 50 words)",
  "concerns": ["List of specific concerns if any, empty array if none"],
  "isAppropriate": true|false  // false for VIOLENCE, MINORS, ILLEGAL or high/critical severity
}
</output_format>`;

export async function describeImage(imageBase64OrUrl: string): Promise<string> {
    const openai = getOpenAI();
    const model = getModel('describe_image');
    const temperature = getTemperature('describe_image', 0.0); // Deterministic for safety

    // If it's a data URL or http URL, use it as is.
    // If it's raw base64, prepend the data URI scheme.
    let imageUrl = imageBase64OrUrl;
    if (!imageBase64OrUrl.startsWith('http') && !imageBase64OrUrl.startsWith('data:')) {
        imageUrl = `data:image/jpeg;base64,${imageBase64OrUrl}`;
    }

    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: SAFETY_ANALYSIS_PROMPT },
                        {
                            type: 'image_url',
                            image_url: {
                                "url": imageUrl,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 300,
            temperature: temperature,
        });

        return response.choices[0].message.content || 'No description available.';
    } catch (error) {
        console.error('Error describing image:', error);
        throw error;
    }
}

/**
 * Analyze image safety and return structured result
 */
export async function analyzeImageSafety(imageBase64OrUrl: string): Promise<ImageSafetyAnalysis> {
    const rawResult = await describeImage(imageBase64OrUrl);

    try {
        // Try to parse as JSON
        let jsonContent = rawResult.trim();
        if (jsonContent.startsWith('```')) {
            jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        return JSON.parse(jsonContent) as ImageSafetyAnalysis;
    } catch {
        // If parsing fails, return a default "uncertain" result
        return {
            category: 'UNCERTAIN',
            severity: 'medium',
            description: rawResult.slice(0, 200),
            concerns: ['Could not parse safety analysis result'],
            isAppropriate: false,
        };
    }
}
