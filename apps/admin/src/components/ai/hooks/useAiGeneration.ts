import { useState, useEffect, useCallback } from 'react';
import {
    generatePack,
    generateQuestionsWithCouncil,
    suggestCategories,
    suggestPacks,
    getCouncilConfig,
    getModel,
    type GeneratedPack,
    type GeneratedQuestion,
    type GeneratedCategoryIdea,
    type GeneratedPackIdea,
    type QuestionReview,
    type CouncilGenerationResult,
    type GenerationCandidate,
    type CherryPickResult,
    type CouncilSelectionMode,
    type GenerationProgress,
} from '@/lib/openai';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

export type GeneratorType = 'pack' | 'questions' | 'category-ideas' | 'category-pack-ideas';

export interface GeneratorContext {
    categoryName?: string;
    packName?: string;
    packDescription?: string | null;
    existingCategories?: string[];
    existingPacks?: string[];
    existingQuestions?: string[];
    isExplicit?: boolean;
}

export interface GenerationConfig {
    count: number;
    isExplicit: boolean;
    crudeLang: boolean;
    inspiration: string;
}

export interface GenerationResults {
    pack: GeneratedPack | null;
    questions: GeneratedQuestion[];
    categoryIdeas: GeneratedCategoryIdea[];
    packIdeas: GeneratedPackIdea[];
}

export interface ReviewState {
    reviews: QuestionReview[];
    summary: CouncilGenerationResult['summary'];
    metadata: CouncilGenerationResult['metadata'] | null;
    selectedGeneratorIndex: number | null;
    allCandidates: GenerationCandidate[] | null;
    cherryPickResult: CherryPickResult | null;
    selectionMode: CouncilSelectionMode;
}

export type ReviewFilter = 'all' | 'pass' | 'flag' | 'reject';

// =============================================================================
// Hook
// =============================================================================

export function useAiGeneration(
    type: GeneratorType,
    context?: GeneratorContext
) {
    // Loading state
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<GenerationProgress | null>(null);

    // Config state
    const [config, setConfig] = useState<GenerationConfig>({
        count: 10,
        isExplicit: Boolean(context?.isExplicit),
        crudeLang: false,
        inspiration: '',
    });

    // Results state
    const [results, setResults] = useState<GenerationResults>({
        pack: null,
        questions: [],
        categoryIdeas: [],
        packIdeas: [],
    });

    // Review state
    const [reviewState, setReviewState] = useState<ReviewState>({
        reviews: [],
        summary: null,
        metadata: null,
        selectedGeneratorIndex: null,
        allCandidates: null,
        cherryPickResult: null,
        selectionMode: 'whole_set',
    });

    // Selection state
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [filter, setFilter] = useState<ReviewFilter>('all');

    // Source model tracking
    const [sourceModel, setSourceModel] = useState<string | null>(null);

    // Previous suggestions tracking (avoid repetition on regenerate)
    const [previousNames, setPreviousNames] = useState<{
        packs: string[];
        categories: string[];
        packIdeas: string[];
    }>({ packs: [], categories: [], packIdeas: [] });

    // Council config
    const councilConfig = getCouncilConfig();

    // Update explicit flag when context changes
    useEffect(() => {
        setConfig(prev => ({
            ...prev,
            isExplicit: Boolean(context?.isExplicit),
        }));
    }, [context?.isExplicit, type]);

    // Config setters
    const setCount = useCallback((count: number) => {
        setConfig(prev => ({ ...prev, count }));
    }, []);

    const setExplicit = useCallback((isExplicit: boolean) => {
        setConfig(prev => ({ ...prev, isExplicit }));
    }, []);

    const setCrudeLang = useCallback((crudeLang: boolean) => {
        setConfig(prev => ({ ...prev, crudeLang }));
    }, []);

    const setInspiration = useCallback((inspiration: string) => {
        setConfig(prev => ({ ...prev, inspiration }));
    }, []);

    // Helper functions
    const getReviewForIndex = useCallback((index: number): QuestionReview | undefined => {
        return reviewState.reviews.find(r => r.index === index);
    }, [reviewState.reviews]);

    const getFilteredQuestionIndices = useCallback((): number[] => {
        if (results.questions.length === 0) return [];
        if (filter === 'all' || reviewState.reviews.length === 0) {
            return results.questions.map((_, i) => i);
        }
        return reviewState.reviews
            .filter(r => r.verdict === filter)
            .map(r => r.index);
    }, [results.questions, reviewState.reviews, filter]);

    // Selection handlers
    const toggleSelection = useCallback((index: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIndices(new Set(results.questions.map((_, i) => i)));
    }, [results.questions]);

    const deselectAll = useCallback(() => {
        setSelectedIndices(new Set());
    }, []);

    // Reset all state
    const reset = useCallback(() => {
        setResults({ pack: null, questions: [], categoryIdeas: [], packIdeas: [] });
        setSelectedIndices(new Set());
        setConfig(prev => ({ ...prev, crudeLang: false, inspiration: '' }));
        setReviewState({
            reviews: [],
            summary: null,
            metadata: null,
            selectedGeneratorIndex: null,
            allCandidates: null,
            cherryPickResult: null,
            selectionMode: 'whole_set',
        });
        setFilter('all');
        setProgress(null);
        setSourceModel(null);
        setPreviousNames({ packs: [], categories: [], packIdeas: [] });
    }, []);

    // Main generate function
    const generate = useCallback(async () => {
        setLoading(true);
        setProgress(null);

        // Reset review state
        setReviewState({
            reviews: [],
            summary: null,
            metadata: null,
            selectedGeneratorIndex: null,
            allCandidates: null,
            cherryPickResult: null,
            selectionMode: 'whole_set',
        });
        setFilter('all');
        setSourceModel(null);

        const isExplicit = config.isExplicit;

        try {
            if (type === 'pack') {
                // Track previous names to avoid repetition
                const avoidNames = results.pack
                    ? [...previousNames.packs, results.pack.name]
                    : previousNames.packs;
                if (results.pack) {
                    setPreviousNames(prev => ({ ...prev, packs: avoidNames }));
                }

                const model = getModel('generate');
                const result = await generatePack(
                    context?.categoryName,
                    isExplicit,
                    config.crudeLang,
                    config.inspiration || undefined,
                    avoidNames
                );
                setResults(prev => ({ ...prev, pack: result }));
                setSourceModel(model);

            } else if (type === 'questions') {
                if (!context?.packName) {
                    toast.error('Pack name is required');
                    setLoading(false);
                    return;
                }

                const result = await generateQuestionsWithCouncil(
                    context.packName,
                    config.count,
                    undefined,
                    isExplicit ? 5 : 2,
                    context.packDescription || undefined,
                    context.existingQuestions,
                    config.crudeLang,
                    config.inspiration || undefined,
                    setProgress
                );

                const questions = result.questions || [];
                const reviews = result.reviews || [];

                setResults(prev => ({ ...prev, questions }));
                setReviewState({
                    reviews,
                    summary: result.summary,
                    metadata: result.metadata,
                    selectedGeneratorIndex: result.selectedGeneratorIndex,
                    allCandidates: result.allCandidates,
                    cherryPickResult: result.cherryPickResult || null,
                    selectionMode: result.selectionMode || 'whole_set',
                });

                // Smart selection based on review results
                if (reviews.length > 0) {
                    const selected = new Set<number>();
                    reviews.forEach(r => {
                        if (r.verdict === 'pass' || r.verdict === 'flag') {
                            selected.add(r.index);
                        }
                    });
                    setSelectedIndices(selected);

                    if (result.summary) {
                        const { passed, flagged, rejected } = result.summary;
                        if (rejected > 0) {
                            toast.warning(`Review complete: ${passed} passed, ${flagged} flagged, ${rejected} rejected`);
                        } else {
                            toast.success(`Review complete: ${passed} passed, ${flagged} flagged`);
                        }
                    }
                } else {
                    setSelectedIndices(new Set(questions.map((_, i) => i)));
                    if (councilConfig.enabled && !result.metadata?.reviewerModel) {
                        toast.warning('Council review failed - showing unreviewed questions');
                    }
                }

            } else if (type === 'category-ideas') {
                const avoidNames = results.categoryIdeas.length > 0
                    ? [...previousNames.categories, ...results.categoryIdeas.map(i => i.name)]
                    : previousNames.categories;
                if (results.categoryIdeas.length > 0) {
                    setPreviousNames(prev => ({ ...prev, categories: avoidNames }));
                }

                const model = getModel('generate');
                const result = await suggestCategories(
                    context?.existingCategories || [],
                    isExplicit,
                    config.crudeLang,
                    config.inspiration || undefined,
                    avoidNames
                );
                setResults(prev => ({ ...prev, categoryIdeas: result }));
                setSourceModel(model);

            } else if (type === 'category-pack-ideas') {
                if (!context?.categoryName) {
                    toast.error('Category name is required');
                    setLoading(false);
                    return;
                }

                const avoidNames = results.packIdeas.length > 0
                    ? [...previousNames.packIdeas, ...results.packIdeas.map(i => i.name)]
                    : previousNames.packIdeas;
                if (results.packIdeas.length > 0) {
                    setPreviousNames(prev => ({ ...prev, packIdeas: avoidNames }));
                }

                const model = getModel('generate');
                const result = await suggestPacks(
                    context.categoryName,
                    context?.existingPacks || [],
                    isExplicit,
                    config.crudeLang,
                    config.inspiration || undefined,
                    avoidNames
                );
                setResults(prev => ({ ...prev, packIdeas: result }));
                setSourceModel(model);
            }
        } catch (error) {
            console.error('AI generation error:', error);
            toast.error('Failed to generate content. Check your API key.');
        } finally {
            setLoading(false);
        }
    }, [type, context, config, results, previousNames, councilConfig.enabled]);

    // Check if there are any results
    const hasResults = Boolean(
        results.pack ||
        results.questions.length > 0 ||
        results.categoryIdeas.length > 0 ||
        results.packIdeas.length > 0
    );

    return {
        // Loading state
        loading,
        progress,

        // Config
        config,
        setCount,
        setExplicit,
        setCrudeLang,
        setInspiration,

        // Results
        results,
        hasResults,
        sourceModel,

        // Review state
        reviewState,
        filter,
        setFilter,
        councilConfig,

        // Selection
        selectedIndices,
        toggleSelection,
        selectAll,
        deselectAll,

        // Helpers
        getReviewForIndex,
        getFilteredQuestionIndices,

        // Actions
        generate,
        reset,
    };
}
