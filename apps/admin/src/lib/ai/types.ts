// =============================================================================
// AI Module Types
// All shared interfaces and type definitions
// =============================================================================

// Model purpose for selecting appropriate model
export type ModelPurpose = 'generate' | 'fix' | 'polish' | 'describe_image';

// =============================================================================
// COUNCIL CONFIGURATION TYPES
// =============================================================================

export interface CouncilGenerator {
    model: string;
    temperature?: number;
}

export type CouncilSelectionMode = 'whole_set' | 'cherry_pick';

export interface CouncilConfig {
    enabled: boolean;
    generators: CouncilGenerator[];
    reviewerModel: string;
    reviewerTemperature?: number;
    selectionMode: CouncilSelectionMode;
    cherryPickEnsureIntensityDistribution: boolean;
}

// =============================================================================
// GENERATION TYPES
// =============================================================================

export interface GeneratedPack {
    name: string;
    description: string;
    icon?: string;
}

export interface GeneratedQuestion {
    text: string;
    partner_text?: string;
    intensity: number;
    requires_props?: string[] | null;
    location_type?: 'home' | 'public' | 'outdoors' | 'travel' | 'anywhere';
    effort_level?: 'spontaneous' | 'low' | 'medium' | 'planned';
    // Inverse pair tracking - questions with the same inverse_pair_id are inverses of each other
    // First question in pair (lower array index) is primary, second gets inverse_of set
    inverse_pair_id?: string | null;
    // Cherry-pick provenance (only set in cherry-pick mode)
    sourceGeneratorIndex?: number;
    sourceGeneratorModel?: string;
}

export interface GeneratedCategoryIdea {
    name: string;
    description: string;
    icon: string;
}

export interface GeneratedPackIdea {
    name: string;
    description: string;
    icon: string;
}

// =============================================================================
// REVIEW TYPES
// =============================================================================

export interface QuestionReviewScores {
    guidelineCompliance: number;
    creativity: number;
    clarity: number;
    intensityAccuracy: number;
    anatomicalConsistency: number;
    partnerTextQuality: number;
    coupleTargeting: number;
    initiatorTargeting: number;
}

export interface QuestionReview {
    index: number;
    verdict: 'pass' | 'flag' | 'reject';
    issues: string[];
    suggestions?: string;
    scores: QuestionReviewScores;
    // Additional detailed feedback
    intensitySuggestion?: number | null; // Suggested intensity if current seems wrong
    targetingSuggestions?: {
        suggestedCoupleTargets?: string[] | null;
        suggestedInitiator?: string[] | null;
        reason?: string;
    };
}

export interface ReviewResult {
    reviews: QuestionReview[];
    summary: {
        passed: number;
        flagged: number;
        rejected: number;
        overallQuality: number;
    };
}

// =============================================================================
// COUNCIL GENERATION TYPES
// =============================================================================

export interface GenerationCandidate {
    generatorIndex: number;
    generatorModel: string;
    questions: GeneratedQuestion[];
    generationTime: number;
}

export interface CouncilGenerationResult {
    questions: GeneratedQuestion[];
    reviews: QuestionReview[];
    summary: ReviewResult['summary'] | null;
    selectedGeneratorIndex: number | null;
    allCandidates: GenerationCandidate[] | null;
    cherryPickResult?: CherryPickResult | null;
    selectionMode: CouncilSelectionMode;
    metadata: {
        generatorModels: string[];
        reviewerModel: string | null;
        totalGenerationTime: number;
        reviewTime: number;
        pooledQuestionCount?: number;
    };
}

// =============================================================================
// PROGRESS CALLBACK TYPES
// =============================================================================

export type GeneratorStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface GenerationProgress {
    phase: 'generating' | 'reviewing' | 'complete';
    generators: {
        model: string;
        shortName: string;
        status: GeneratorStatus;
        questionCount?: number;
        timeMs?: number;
    }[];
    reviewer?: {
        model: string;
        shortName: string;
        status: 'pending' | 'reviewing' | 'completed';
    };
    message: string;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

// =============================================================================
// CHERRY-PICK MODE TYPES
// =============================================================================

export interface PooledQuestion extends GeneratedQuestion {
    sourceGeneratorIndex: number;
    sourceGeneratorModel: string;
    sourceQuestionIndex: number;
}

export interface CherryPickEvaluation {
    questionIndex: number;
    overallScore: number;
    scores: {
        guidelineCompliance: number;
        creativity: number;
        clarity: number;
        intensityAccuracy: number;
        uniqueness: number;
    };
    isDuplicate: boolean;
    duplicateOf?: number;
    issues: string[];
    verdict: 'select' | 'consider' | 'skip';
}

export interface CherryPickResult {
    selectedQuestions: PooledQuestion[];
    evaluations: CherryPickEvaluation[];
    poolSize: number;
    duplicatesRemoved: number;
    intensityDistribution: Record<number, number>;
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

export interface TargetAnalysis {
    id: string;
    suggested_targets: string[] | null;
    suggested_initiator: string[] | null;
    reason: string;
}

export interface TextAnalysis {
    id: string;
    suggested_text: string;
    suggested_partner_text: string | null;
    reason: string;
    // Intensity suggestion (only if AI thinks current is wrong)
    suggested_intensity?: number | null;
    intensity_reason?: string | null;
}

export interface DeletionAnalysis {
    id: string;
    category: 'duplicate' | 'redundant' | 'off-tone' | 'unsafe' | 'too-vague' | 'broken' | 'off-topic';
    reason: string;
    duplicate_of_id?: string | null;
}

export interface PropsAnalysis {
    id: string;
    suggested_required_props: string[] | null;
    reason: string;
}

export interface ExtractedTopic {
    name: string;
    isNew: boolean;
    existingTopicId?: string;
}

export interface TopicExtractionResult {
    topics: ExtractedTopic[];
    reasoning: string;
}

// =============================================================================
// SELECTION TYPES
// =============================================================================

export interface SelectionResult {
    selectedIndex: number;
    reviews: QuestionReview[];
    summary: ReviewResult['summary'];
    reasoning: string;
}

// =============================================================================
// TONE LEVEL TYPE
// =============================================================================

export type ToneLevel = 1 | 2 | 3 | 4 | 5;
