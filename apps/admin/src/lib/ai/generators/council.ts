// =============================================================================
// Council Generation
// Multi-model generation with review and selection
// =============================================================================

import { getModel, getShortModelName } from '../client';
import { getCouncilConfig } from '../config';
import { generateQuestions, generateQuestionsWithModel } from './questions';
import { selectBestGeneration } from '../review';
import { performCherryPickSelection } from './cherry-pick';
import type {
    ToneLevel,
    GenerationProgress,
    ProgressCallback,
    GeneratorStatus,
    GenerationCandidate,
    CouncilGenerationResult,
} from '../types';

/**
 * Generate questions using the council system
 * Runs multiple generators in parallel and uses a reviewer to select the best output
 */
export async function generateQuestionsWithCouncil(
    packName: string,
    count: number = 10,
    intensity?: number,
    tone: ToneLevel = 3,
    packDescription?: string,
    existingQuestions?: string[],
    crudeLang: boolean = false,
    inspiration?: string,
    onProgress?: ProgressCallback
): Promise<CouncilGenerationResult> {
    const config = getCouncilConfig();

    // Helper to build progress update
    const buildProgress = (
        phase: GenerationProgress['phase'],
        generatorStatuses: GeneratorStatus[],
        generatorResults: (GenerationCandidate | null)[],
        reviewerStatus?: 'pending' | 'reviewing' | 'completed'
    ): GenerationProgress => {
        const completedCount = generatorStatuses.filter(s => s === 'completed').length;
        const totalCount = config.generators.length;

        let message = '';
        if (phase === 'generating') {
            if (completedCount === 0) {
                message = `Generating with ${totalCount} model${totalCount > 1 ? 's' : ''}...`;
            } else if (completedCount < totalCount) {
                message = `${completedCount}/${totalCount} generators complete...`;
            } else {
                message = 'All generators complete';
            }
        } else if (phase === 'reviewing') {
            message = 'Reviewing and selecting best questions...';
        } else {
            message = 'Complete';
        }

        return {
            phase,
            generators: config.generators.map((gen, i) => ({
                model: gen.model,
                shortName: getShortModelName(gen.model),
                status: generatorStatuses[i],
                questionCount: generatorResults[i]?.questions.length,
                timeMs: generatorResults[i]?.generationTime,
            })),
            reviewer: config.enabled ? {
                model: config.reviewerModel,
                shortName: getShortModelName(config.reviewerModel),
                status: reviewerStatus || 'pending',
            } : undefined,
            message,
        };
    };

    // If council is disabled, use the default generation model
    if (!config.enabled) {
        const defaultModel = getModel('generate');
        onProgress?.({
            phase: 'generating',
            generators: [{ model: defaultModel, shortName: getShortModelName(defaultModel), status: 'generating' }],
            message: 'Generating questions...',
        });

        const startGen = Date.now();
        const questions = await generateQuestions(
            packName,
            count,
            intensity,
            tone,
            packDescription,
            existingQuestions,
            crudeLang,
            inspiration
        );
        const genTime = Date.now() - startGen;

        onProgress?.({
            phase: 'complete',
            generators: [{ model: defaultModel, shortName: getShortModelName(defaultModel), status: 'completed', questionCount: questions.length, timeMs: genTime }],
            message: 'Complete',
        });

        return {
            questions,
            reviews: [],
            summary: null,
            selectedGeneratorIndex: null,
            allCandidates: null,
            selectionMode: 'whole_set',
            metadata: {
                generatorModels: [getModel('generate')],
                reviewerModel: null,
                totalGenerationTime: genTime,
                reviewTime: 0,
            },
        };
    }

    // Initialize tracking for parallel generation
    const generatorStatuses: GeneratorStatus[] = config.generators.map(() => 'pending');
    const generatorResults: (GenerationCandidate | null)[] = config.generators.map(() => null);

    // Initial progress - all generators starting
    generatorStatuses.forEach((_, i) => { generatorStatuses[i] = 'generating'; });
    onProgress?.(buildProgress('generating', generatorStatuses, generatorResults));

    // Step 1: Generate questions with all configured generators in parallel
    const startGen = Date.now();
    const generatorPromises = config.generators.map(async (gen, index) => {
        const genStart = Date.now();
        try {
            const questions = await generateQuestionsWithModel(
                gen.model,
                packName,
                count,
                intensity,
                tone,
                packDescription,
                existingQuestions,
                crudeLang,
                inspiration
            );
            const result = {
                generatorIndex: index,
                generatorModel: gen.model,
                questions,
                generationTime: Date.now() - genStart,
            } as GenerationCandidate;

            // Update status and notify
            generatorStatuses[index] = 'completed';
            generatorResults[index] = result;
            onProgress?.(buildProgress('generating', generatorStatuses, generatorResults));

            return result;
        } catch (error) {
            console.error(`Generator ${index} (${gen.model}) failed:`, error);
            generatorStatuses[index] = 'failed';
            onProgress?.(buildProgress('generating', generatorStatuses, generatorResults));
            return null;
        }
    });

    const results = await Promise.all(generatorPromises);
    const successfulCandidates = results.filter((r): r is GenerationCandidate => r !== null);
    const totalGenerationTime = Date.now() - startGen;

    // If no generators succeeded, throw error
    if (successfulCandidates.length === 0) {
        throw new Error('All generators failed to produce results');
    }

    // Step 2: Selection based on mode
    const startReview = Date.now();
    const isExplicit = tone >= 4;
    const packContext = { name: packName, description: packDescription, isExplicit, tone };

    // Notify that we're entering review phase
    onProgress?.(buildProgress('reviewing', generatorStatuses, generatorResults, 'reviewing'));

    // Branch based on selection mode
    if (config.selectionMode === 'cherry_pick') {
        // Cherry-pick mode: pool all questions and select best individuals
        try {
            const cherryPickResult = await performCherryPickSelection(
                successfulCandidates,
                packContext,
                count,
                config
            );
            const reviewTime = Date.now() - startReview;

            // Calculate total pooled questions
            const pooledCount = successfulCandidates.reduce((sum, c) => sum + c.questions.length, 0);

            // Notify completion
            onProgress?.(buildProgress('complete', generatorStatuses, generatorResults, 'completed'));

            return {
                questions: cherryPickResult.questions,
                reviews: cherryPickResult.reviews,
                summary: cherryPickResult.summary,
                selectedGeneratorIndex: null, // Not applicable for cherry-pick
                allCandidates: successfulCandidates,
                cherryPickResult: cherryPickResult.cherryPickResult,
                selectionMode: 'cherry_pick',
                metadata: {
                    generatorModels: config.generators.map(g => g.model),
                    reviewerModel: config.reviewerModel,
                    totalGenerationTime,
                    reviewTime,
                    pooledQuestionCount: pooledCount,
                },
            };
        } catch (error) {
            // If cherry-pick fails, fall back to first generation
            console.error('Cherry-pick selection failed:', error);
            const firstCandidate = successfulCandidates[0];

            onProgress?.(buildProgress('complete', generatorStatuses, generatorResults, 'completed'));

            return {
                questions: firstCandidate.questions,
                reviews: [],
                summary: null,
                selectedGeneratorIndex: 0,
                allCandidates: successfulCandidates,
                selectionMode: 'cherry_pick',
                metadata: {
                    generatorModels: config.generators.map(g => g.model),
                    reviewerModel: null,
                    totalGenerationTime,
                    reviewTime: 0,
                },
            };
        }
    } else {
        // Whole-set mode: select best complete set from one generator
        try {
            const selectionResult = await selectBestGeneration(successfulCandidates, packContext);
            const reviewTime = Date.now() - startReview;

            const selectedCandidate = successfulCandidates[selectionResult.selectedIndex];

            // Notify completion
            onProgress?.(buildProgress('complete', generatorStatuses, generatorResults, 'completed'));

            return {
                questions: selectedCandidate.questions,
                reviews: selectionResult.reviews,
                summary: selectionResult.summary,
                selectedGeneratorIndex: selectionResult.selectedIndex,
                allCandidates: successfulCandidates,
                selectionMode: 'whole_set',
                metadata: {
                    generatorModels: config.generators.map(g => g.model),
                    reviewerModel: config.reviewerModel,
                    totalGenerationTime,
                    reviewTime,
                },
            };
        } catch (error) {
            // If selection/review fails, return the first successful generation without review
            console.error('Council selection/review failed:', error);
            const firstCandidate = successfulCandidates[0];

            onProgress?.(buildProgress('complete', generatorStatuses, generatorResults, 'completed'));

            return {
                questions: firstCandidate.questions,
                reviews: [],
                summary: null,
                selectedGeneratorIndex: 0,
                allCandidates: successfulCandidates,
                selectionMode: 'whole_set',
                metadata: {
                    generatorModels: config.generators.map(g => g.model),
                    reviewerModel: null,
                    totalGenerationTime,
                    reviewTime: 0,
                },
            };
        }
    }
}
