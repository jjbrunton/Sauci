// =============================================================================
// AI Module - Main Entry Point
// Re-exports all public APIs for backwards compatibility
// =============================================================================

// Types
export type {
    ModelPurpose,
    CouncilGenerator,
    CouncilSelectionMode,
    CouncilConfig,
    GeneratedPack,
    GeneratedQuestion,
    GeneratedCategoryIdea,
    GeneratedPackIdea,
    QuestionReview,
    ReviewResult,
    GenerationCandidate,
    CouncilGenerationResult,
    GeneratorStatus,
    GenerationProgress,
    ProgressCallback,
    PooledQuestion,
    CherryPickEvaluation,
    CherryPickResult,
    TargetAnalysis,
    TextAnalysis,
    ExtractedTopic,
    TopicExtractionResult,
    SelectionResult,
    ToneLevel,
} from './types';

// Client
export { getOpenAI, getModel, getShortModelName } from './client';

// Config
export {
    getCouncilConfig,
    initializeAiConfig,
    TONE_LEVELS,
    INTENSITY_LEVELS,
    INTENSITY_GUIDE,
    INTENSITY_GUIDE_SHORT,
    REVIEW_GUIDELINES,
    TONE_INSTRUCTIONS,
    SYSTEM_MESSAGES,
} from './config';

// Generators
export { generatePack, suggestPacks } from './generators/packs';
export { generateCategory, suggestCategories } from './generators/categories';
export { generateQuestions, generateQuestionsWithModel } from './generators/questions';
export { generateQuestionsWithCouncil } from './generators/council';

// Review
export { reviewGeneratedQuestions, selectBestGeneration } from './review';

// Analyzers
export { analyzeQuestionText } from './analyzers/text';
export { analyzeQuestionTargets } from './analyzers/targets';

// Tools
export { polishContent } from './tools/polish';
export { extractTopicsFromPack } from './tools/topics';
