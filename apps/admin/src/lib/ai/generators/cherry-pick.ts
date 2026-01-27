// =============================================================================
// Cherry-Pick Mode Functions
// Pool questions from multiple generators and select the best individuals
// =============================================================================

import { getOpenAI } from '../client';
import { getCouncilConfig, REVIEW_GUIDELINES, TONE_LEVELS } from '../config';
import type {
    GeneratedQuestion,
    QuestionReview,
    ReviewResult,
    ToneLevel,
    GenerationCandidate,
    PooledQuestion,
    CherryPickEvaluation,
    CherryPickResult,
} from '../types';

/**
 * Evaluate all questions in the pool and identify duplicates
 */
export async function evaluateQuestionPool(
    pooledQuestions: PooledQuestion[],
    packContext: { name: string; description?: string | null; isExplicit: boolean; tone: ToneLevel },
    requestedCount: number
): Promise<CherryPickEvaluation[]> {
    const openai = getOpenAI();
    const config = getCouncilConfig();

    const toneDescription = TONE_LEVELS.find(t => t.level === packContext.tone)?.label || 'Unknown';

    const questionsForEval = pooledQuestions.map((q, i) => ({
        index: i,
        text: q.text,
        partner_text: q.partner_text || null,
        generatorIndex: q.sourceGeneratorIndex,
    }));

    const prompt = `<task>
Evaluate a pool of ${pooledQuestions.length} questions from ${new Set(pooledQuestions.map(q => q.sourceGeneratorIndex)).size} different AI generators and select the best ones.
</task>

<objectives>
1. Score each question individually (1-10 on each criterion)
2. Identify duplicates/semantically similar questions
3. Assess uniqueness relative to the pool
4. Consider pack theme fit
</objectives>

<pack_context>
- Pack Name: "${packContext.name}"
${packContext.description ? `- Pack Description: "${packContext.description}"` : ''}
- Content Type: ${packContext.isExplicit ? 'EXPLICIT (adult content allowed)' : 'NON-EXPLICIT (clean/romantic only)'}
- Tone Level: ${packContext.tone} (${toneDescription})
- Requested question count: ${requestedCount}
</pack_context>

<scoring_criteria>
${REVIEW_GUIDELINES}

5. UNIQUENESS (1-10):
   - 10: Completely unique concept in the pool
   - 7-9: Somewhat similar theme but distinct execution
   - 4-6: Similar to another question but different enough to keep
   - 1-3: Near-duplicate of another question
</scoring_criteria>

<scoring_weights>
Your scores will be weighted as follows for final selection:
- Guideline Compliance: 30%
- Creativity: 25%
- Clarity: 25%
- Uniqueness: 20%

Calibrate your scores knowing these weights. A low compliance score has the most impact.
</scoring_weights>

<duplicate_detection>
Two questions are duplicates if they:
- Describe the same core activity/action (e.g., "Have sex outdoors" vs "Make love outside")
- Differ only in minor phrasing variations
- Would feel repetitive if both appeared in the same pack

For duplicates, mark the WORSE version as duplicate and keep the version with:
1. Better phrasing/creativity
2. Better partner_text (if applicable)
</duplicate_detection>

<verdict_rules>
- SELECT: Average score >= 7, no major issues - should be included
- CONSIDER: Average score 5-7 - include if needed to fill count
- SKIP: Average score < 5 OR is a duplicate of a better question
</verdict_rules>

<questions_to_evaluate>
${JSON.stringify(questionsForEval, null, 2)}
</questions_to_evaluate>

<output_format>
{
  "evaluations": [
    {
      "questionIndex": number,        // 0-based index in the questions array
      "overallScore": number,         // Weighted score 0-100
      "scores": {
        "guidelineCompliance": 1-10,
        "creativity": 1-10,
        "clarity": 1-10,
        "uniqueness": 1-10
      },
      "isDuplicate": boolean,
      "duplicateOf": number|null,     // Index of the better version if duplicate
      "issues": string[],             // List of issues found
      "verdict": "select"|"consider"|"skip"
    }
  ]
}

Evaluate ALL ${pooledQuestions.length} questions.
</output_format>`;

    const response = await openai.chat.completions.create({
        model: config.reviewerModel,
        messages: [
            {
                role: 'system',
                content: 'You are a quality reviewer for a couples intimacy app. You evaluate and compare questions from multiple AI generators to select the best ones. Be thorough and fair. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: config.reviewerTemperature ?? 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No evaluation content generated');

    // Strip markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonContent);
    return parsed.evaluations || [];
}

/**
 * Select top N questions from evaluations
 */
export function selectTopQuestions(
    pooledQuestions: PooledQuestion[],
    evaluations: CherryPickEvaluation[],
    requestedCount: number
): CherryPickResult {
    // Step 1: Filter out duplicates (keep only the original, not the duplicate)
    const duplicateIndices = new Set<number>();
    for (const evaluation of evaluations) {
        if (evaluation.isDuplicate && evaluation.duplicateOf !== undefined) {
            duplicateIndices.add(evaluation.questionIndex);
        }
    }

    // Step 2: Create scored list of non-duplicate questions
    const scoredQuestions = evaluations
        .filter(e => !duplicateIndices.has(e.questionIndex))
        .map(e => ({
            evaluation: e,
            question: pooledQuestions[e.questionIndex],
            // Weighted overall score
            weightedScore: (
                (e.scores.guidelineCompliance * 0.30) +
                (e.scores.creativity * 0.25) +
                (e.scores.clarity * 0.25) +
                (e.scores.uniqueness * 0.20)
            ) * 10,
        }))
        .sort((a, b) => b.weightedScore - a.weightedScore);

    // Step 3: Select top N by score
    const selected = scoredQuestions.slice(0, requestedCount);

    // Step 4: Build result
    const selectedQuestions = selected.map(s => s.question);

    return {
        selectedQuestions,
        evaluations,
        poolSize: pooledQuestions.length,
        duplicatesRemoved: duplicateIndices.size,
    };
}

/**
 * Perform cherry-pick selection: pool all questions, evaluate, and select best
 */
export async function performCherryPickSelection(
    candidates: GenerationCandidate[],
    packContext: { name: string; description?: string | null; isExplicit: boolean; tone: ToneLevel },
    requestedCount: number
): Promise<{
    questions: GeneratedQuestion[];
    reviews: QuestionReview[];
    summary: ReviewResult['summary'];
    cherryPickResult: CherryPickResult;
}> {
    // Step 1: Pool all questions with provenance
    const pooledQuestions: PooledQuestion[] = [];
    for (const candidate of candidates) {
        for (let qi = 0; qi < candidate.questions.length; qi++) {
            pooledQuestions.push({
                ...candidate.questions[qi],
                sourceGeneratorIndex: candidate.generatorIndex,
                sourceGeneratorModel: candidate.generatorModel,
                sourceQuestionIndex: qi,
            });
        }
    }

    // Step 2: Evaluate entire pool
    const evaluations = await evaluateQuestionPool(pooledQuestions, packContext, requestedCount);

    // Step 3: Select top questions
    const cherryPickResult = selectTopQuestions(pooledQuestions, evaluations, requestedCount);

    // Step 4: Convert to standard review format for UI compatibility
    const reviews: QuestionReview[] = cherryPickResult.selectedQuestions.map((q, i) => {
        // Find the evaluation for this question
        const poolIndex = pooledQuestions.findIndex(
            pq => pq.text === q.text && pq.sourceGeneratorIndex === q.sourceGeneratorIndex
        );
        const evaluation = evaluations.find(e => e.questionIndex === poolIndex);

        if (!evaluation) {
            return {
                index: i,
                verdict: 'pass' as const,
                issues: [],
                scores: {
                    guidelineCompliance: 7,
                    creativity: 7,
                    clarity: 7,
                    anatomicalConsistency: 10,
                    partnerTextQuality: 10,
                    coupleTargeting: 10,
                    initiatorTargeting: 10,
                },
            };
        }

        // Map cherry-pick verdict to standard verdict
        const verdict: 'pass' | 'flag' | 'reject' =
            evaluation.verdict === 'select' ? 'pass' :
            evaluation.verdict === 'consider' ? 'flag' : 'reject';

        return {
            index: i,
            verdict,
            issues: evaluation.issues,
            scores: {
                guidelineCompliance: evaluation.scores.guidelineCompliance,
                creativity: evaluation.scores.creativity,
                clarity: evaluation.scores.clarity,
                // Cherry-pick doesn't evaluate these, default to passing
                anatomicalConsistency: 10,
                partnerTextQuality: 10,
                coupleTargeting: 10,
                initiatorTargeting: 10,
            },
        };
    });

    // Step 5: Calculate summary
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
            scoreCount += 3;
        }
    }
    const overallQuality = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;

    return {
        questions: cherryPickResult.selectedQuestions,
        reviews,
        summary: { passed, flagged, rejected, overallQuality },
        cherryPickResult,
    };
}
