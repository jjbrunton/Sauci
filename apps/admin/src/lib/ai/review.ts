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
        location_type: q.location_type,
        effort_level: q.effort_level,
        // Include targeting for review (may not always be present)
        allowed_couple_genders: (q as { allowed_couple_genders?: string[] | null }).allowed_couple_genders || null,
        target_user_genders: (q as { target_user_genders?: string[] | null }).target_user_genders || null,
    }));

    const toneDescription = TONE_LEVELS.find(t => t.level === packContext.tone)?.label || 'Unknown';

    const prompt = `<task>
Review each generated question against our quality guidelines.
</task>

<pack_context>
- Pack Name: "${packContext.name}"
${packContext.description ? `- Pack Description: "${packContext.description}"` : ''}
- Content Type: ${packContext.isExplicit ? 'EXPLICIT (adult content allowed)' : 'NON-EXPLICIT (clean/romantic only)'}
- Tone Level: ${packContext.tone} (${toneDescription})
</pack_context>

<scoring_criteria>
${REVIEW_GUIDELINES}
</scoring_criteria>

<verdict_rules>
- PASS: All scores >= 7, no major issues
- FLAG: Any score 5-7, or minor issues worth noting (admin should review but can use)
- REJECT: Any score < 5, or major violations (mixed anatomy, severe guideline violation)
</verdict_rules>

<questions_to_review>
${JSON.stringify(questionsForReview, null, 2)}
</questions_to_review>

<output_format>
{
  "reviews": [
    {
      "index": number,                    // 0-based index of the question
      "verdict": "pass"|"flag"|"reject",
      "issues": string[],                 // List of issues found, empty if none
      "suggestions": string|null,         // Optional improvement suggestion
      "scores": {
        "guidelineCompliance": 1-10,      // Criterion 1
        "creativity": 1-10,               // Criterion 2
        "clarity": 1-10,                  // Criterion 3
        "anatomicalConsistency": 1-10,    // Criterion 4
        "partnerTextQuality": 1-10,       // Criterion 5 (10 if no partner_text needed)
        "coupleTargeting": 1-10,          // Criterion 6
        "initiatorTargeting": 1-10        // Criterion 7 (10 if symmetric)
      },
      "targetingSuggestions": {           // Only include if targeting needs changes
        "suggestedCoupleTargets": string[]|null,  // ["male+male", "female+male", "female+female"] or subset
        "suggestedInitiator": string[]|null,      // ["male", "female"] or null for any
        "reason": string                          // Why targeting should change
      }|null
    }
  ]
}

Review ALL questions against ALL 7 criteria. Be thorough but fair - only flag/reject for genuine issues.
</output_format>`;

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
        temperature: config.reviewerTemperature ?? 0.3,
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

    // Calculate overall quality as weighted average of all 7 scores
    // Weights: guidelineCompliance 25%, creativity 18%, clarity 18%,
    //          anatomicalConsistency 17%, partnerTextQuality 12%, coupleTargeting 5%, initiatorTargeting 5%
    let totalWeightedScore = 0;
    let totalWeight = 0;
    const weights = {
        guidelineCompliance: 0.25,
        creativity: 0.18,
        clarity: 0.18,
        anatomicalConsistency: 0.17,
        partnerTextQuality: 0.12,
        coupleTargeting: 0.05,
        initiatorTargeting: 0.05,
    };
    for (const review of reviews) {
        if (review.scores) {
            for (const [key, weight] of Object.entries(weights)) {
                const score = review.scores[key as keyof typeof review.scores] || 0;
                totalWeightedScore += score * weight;
                totalWeight += weight;
            }
        }
    }
    const overallQuality = totalWeight > 0 ? Math.round((totalWeightedScore / (totalWeight / Object.keys(weights).length)) * 10) / 10 : 0;

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
            allowed_couple_genders: (q as { allowed_couple_genders?: string[] | null }).allowed_couple_genders || null,
            target_user_genders: (q as { target_user_genders?: string[] | null }).target_user_genders || null,
        })),
    }));

    const prompt = `<task>
Compare ${candidates.length} different sets of generated questions from different AI models. Select the best set and review it in detail.
</task>

<objectives>
1. COMPARE all sets and SELECT the BEST one overall
2. REVIEW the selected set in detail
</objectives>

<pack_context>
- Pack Name: "${packContext.name}"
${packContext.description ? `- Pack Description: "${packContext.description}"` : ''}
- Content Type: ${packContext.isExplicit ? 'EXPLICIT (adult content allowed)' : 'NON-EXPLICIT (clean/romantic only)'}
- Tone Level: ${packContext.tone} (${toneDescription})
</pack_context>

<scoring_criteria>
${REVIEW_GUIDELINES}
</scoring_criteria>

<candidate_sets>
${JSON.stringify(candidatesForReview, null, 2)}
</candidate_sets>

<selection_criteria>
Ranked by importance (approximate weights):
1. Overall quality and creativity of questions (30%)
2. Variety and uniqueness within the set (20%)
3. Adherence to pack theme and tone (20%)
4. Correct use of "your partner" language (15%)
5. Quality of partner_text for asymmetric questions (10%)
</selection_criteria>

<output_format>
{
  "selectedIndex": number,          // 0-based index of the best candidate set
  "reasoning": string,              // Brief explanation of why this set was chosen
  "reviews": [
    {
      "index": number,              // Question index within selected set
      "verdict": "pass"|"flag"|"reject",
      "issues": string[],
      "suggestions": string|null,
      "scores": {
        "guidelineCompliance": 1-10,
        "creativity": 1-10,
        "clarity": 1-10,
        "anatomicalConsistency": 1-10,
        "partnerTextQuality": 1-10,
        "coupleTargeting": 1-10,
        "initiatorTargeting": 1-10
      },
      "targetingSuggestions": {
        "suggestedCoupleTargets": string[]|null,
        "suggestedInitiator": string[]|null,
        "reason": string
      }|null
    }
  ]
}

Select the best set and review ALL questions in that set against ALL 7 criteria.
</output_format>`;

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
        temperature: config.reviewerTemperature ?? 0.3,
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

    // Calculate summary with weighted average of all 7 scores
    const passed = reviews.filter(r => r.verdict === 'pass').length;
    const flagged = reviews.filter(r => r.verdict === 'flag').length;
    const rejected = reviews.filter(r => r.verdict === 'reject').length;

    let totalWeightedScore = 0;
    let totalWeight = 0;
    const weights = {
        guidelineCompliance: 0.25,
        creativity: 0.18,
        clarity: 0.18,
        anatomicalConsistency: 0.17,
        partnerTextQuality: 0.12,
        coupleTargeting: 0.05,
        initiatorTargeting: 0.05,
    };
    for (const review of reviews) {
        if (review.scores) {
            for (const [key, weight] of Object.entries(weights)) {
                const score = review.scores[key as keyof typeof review.scores] || 0;
                totalWeightedScore += score * weight;
                totalWeight += weight;
            }
        }
    }
    const overallQuality = totalWeight > 0 ? Math.round((totalWeightedScore / (totalWeight / Object.keys(weights).length)) * 10) / 10 : 0;

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
