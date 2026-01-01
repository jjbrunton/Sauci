// =============================================================================
// Question Review Functions
// Council reviewer for quality assessment of generated questions
// =============================================================================

import { getOpenAI } from './client';
import { getCouncilConfig, REVIEW_GUIDELINES, TONE_LEVELS } from './config';
import type {
    GeneratedQuestion,
    QuestionReview,
    ReviewResult,
    ToneLevel,
    GenerationCandidate,
    SelectionResult,
} from './types';

/**
 * Review generated questions for quality
 */
export async function reviewGeneratedQuestions(
    questions: GeneratedQuestion[],
    packContext: { name: string; description?: string | null; isExplicit: boolean; tone: ToneLevel }
): Promise<ReviewResult> {
    const openai = getOpenAI();
    const config = getCouncilConfig();

    // Null safety check
    if (!questions || questions.length === 0) {
        return {
            reviews: [],
            summary: { passed: 0, flagged: 0, rejected: 0, overallQuality: 0 },
        };
    }

    const questionsForReview = questions.map((q, i) => ({
        index: i,
        text: q.text,
        partner_text: q.partner_text || null,
        intensity: q.intensity,
        location_type: q.location_type,
        effort_level: q.effort_level,
    }));

    const toneDescription = TONE_LEVELS.find(t => t.level === packContext.tone)?.label || 'Unknown';

    const prompt = `You are a quality reviewer for a couples intimacy app. Review each generated question against our guidelines.

PACK CONTEXT:
- Pack Name: "${packContext.name}"
${packContext.description ? `- Pack Description: "${packContext.description}"` : ''}
- Content Type: ${packContext.isExplicit ? 'EXPLICIT (adult content allowed)' : 'NON-EXPLICIT (clean/romantic only)'}
- Tone Level: ${packContext.tone} (${toneDescription})

${REVIEW_GUIDELINES}

VERDICT RULES:
- PASS: All scores >= 7, no major issues
- FLAG: Any score 5-7, or minor issues worth noting (admin should review but can use)
- REJECT: Any score < 5, or major violations (mixed anatomy, wrong intensity, severe guideline violation)

QUESTIONS TO REVIEW:
${JSON.stringify(questionsForReview, null, 2)}

Return a JSON object with:
{
  "reviews": [
    {
      "index": 0,
      "verdict": "pass" | "flag" | "reject",
      "issues": ["Issue 1", "Issue 2"],
      "suggestions": "Optional improvement suggestion",
      "scores": {
        "guidelineCompliance": 8,
        "creativity": 7,
        "clarity": 9,
        "intensityAccuracy": 8
      }
    }
  ]
}

Review ALL questions. Be thorough but fair - only flag/reject for genuine issues.`;

    const response = await openai.chat.completions.create({
        model: config.reviewerModel,
        messages: [
            {
                role: 'system',
                content: 'You are a quality assurance reviewer for a couples intimacy app. You evaluate generated questions for guideline compliance, creativity, clarity, and accuracy. Be thorough but fair. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No review content generated');

    // Strip markdown code blocks if present (some models ignore response_format)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonContent);
    const reviews: QuestionReview[] = parsed.reviews || [];

    // Calculate summary
    const passed = reviews.filter(r => r.verdict === 'pass').length;
    const flagged = reviews.filter(r => r.verdict === 'flag').length;
    const rejected = reviews.filter(r => r.verdict === 'reject').length;

    // Calculate overall quality as average of all scores
    let totalScore = 0;
    let scoreCount = 0;
    for (const review of reviews) {
        if (review.scores) {
            totalScore += review.scores.guidelineCompliance || 0;
            totalScore += review.scores.creativity || 0;
            totalScore += review.scores.clarity || 0;
            totalScore += review.scores.intensityAccuracy || 0;
            scoreCount += 4;
        }
    }
    const overallQuality = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;

    return {
        reviews,
        summary: {
            passed,
            flagged,
            rejected,
            overallQuality,
        },
    };
}

/**
 * Ask the reviewer to select the best generation from multiple candidates
 */
export async function selectBestGeneration(
    candidates: GenerationCandidate[],
    packContext: { name: string; description?: string | null; isExplicit: boolean; tone: ToneLevel }
): Promise<SelectionResult> {
    const openai = getOpenAI();
    const config = getCouncilConfig();

    // If only one candidate, just review it normally
    if (candidates.length === 1) {
        const reviewResult = await reviewGeneratedQuestions(candidates[0].questions, packContext);
        return {
            selectedIndex: 0,
            reviews: reviewResult.reviews,
            summary: reviewResult.summary,
            reasoning: 'Single generator - no selection needed',
        };
    }

    const toneDescription = TONE_LEVELS.find(t => t.level === packContext.tone)?.label || 'Unknown';

    // Build prompt for selection
    const candidatesForReview = candidates.map((c, i) => ({
        generatorIndex: i,
        generatorModel: c.generatorModel,
        questions: c.questions.map((q, qi) => ({
            index: qi,
            text: q.text,
            partner_text: q.partner_text || null,
            intensity: q.intensity,
        })),
    }));

    const prompt = `You are a quality reviewer for a couples intimacy app. You have received ${candidates.length} different sets of generated questions from different AI models. Your task is to:

1. COMPARE all sets and SELECT the BEST one overall
2. REVIEW the selected set in detail

PACK CONTEXT:
- Pack Name: "${packContext.name}"
${packContext.description ? `- Pack Description: "${packContext.description}"` : ''}
- Content Type: ${packContext.isExplicit ? 'EXPLICIT (adult content allowed)' : 'NON-EXPLICIT (clean/romantic only)'}
- Tone Level: ${packContext.tone} (${toneDescription})

${REVIEW_GUIDELINES}

CANDIDATE SETS:
${JSON.stringify(candidatesForReview, null, 2)}

SELECTION CRITERIA (in order of importance):
1. Overall quality and creativity of questions
2. Variety and uniqueness within the set
3. Adherence to pack theme and tone
4. Proper intensity grading
5. Correct use of "your partner" language
6. Quality of partner_text for asymmetric questions

Return a JSON object with:
{
  "selectedIndex": <0-based index of the best candidate set>,
  "reasoning": "<brief explanation of why this set was chosen>",
  "reviews": [
    {
      "index": <question index within selected set>,
      "verdict": "pass" | "flag" | "reject",
      "issues": ["Issue 1", "Issue 2"],
      "suggestions": "Optional improvement suggestion",
      "scores": {
        "guidelineCompliance": 1-10,
        "creativity": 1-10,
        "clarity": 1-10,
        "intensityAccuracy": 1-10
      }
    }
  ]
}

Select the best set and review ALL questions in that set.`;

    const response = await openai.chat.completions.create({
        model: config.reviewerModel,
        messages: [
            {
                role: 'system',
                content: 'You are a quality assurance reviewer for a couples intimacy app. You compare multiple AI-generated question sets and select the best one, then provide detailed reviews. Be thorough but fair. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No selection content generated');

    // Strip markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonContent);
    const selectedIndex = parsed.selectedIndex ?? 0;
    const reviews: QuestionReview[] = parsed.reviews || [];
    const reasoning = parsed.reasoning || 'No reasoning provided';

    // Calculate summary
    const passed = reviews.filter(r => r.verdict === 'pass').length;
    const flagged = reviews.filter(r => r.verdict === 'flag').length;
    const rejected = reviews.filter(r => r.verdict === 'reject').length;

    let totalScore = 0;
    let scoreCount = 0;
    for (const review of reviews) {
        if (review.scores) {
            totalScore += review.scores.guidelineCompliance || 0;
            totalScore += review.scores.creativity || 0;
            totalScore += review.scores.clarity || 0;
            totalScore += review.scores.intensityAccuracy || 0;
            scoreCount += 4;
        }
    }
    const overallQuality = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;

    return {
        selectedIndex,
        reviews,
        summary: {
            passed,
            flagged,
            rejected,
            overallQuality,
        },
        reasoning,
    };
}
