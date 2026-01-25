import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    CheckSquare,
    Square,
    Filter,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Bot,
} from 'lucide-react';
import {
    type GeneratedQuestion,
    type QuestionReview,
    type CouncilGenerationResult,
    type CouncilSelectionMode,
} from '@/lib/openai';
import type { ReviewFilter } from './hooks/useAiGeneration';

// =============================================================================
// Types
// =============================================================================

interface QuestionListProps {
    questions: GeneratedQuestion[];
    reviews: QuestionReview[];
    reviewSummary: CouncilGenerationResult['summary'];
    selectionMode: CouncilSelectionMode;
    selectedIndices: Set<number>;
    filter: ReviewFilter;
    filteredIndices: number[];
    onToggleSelection: (index: number) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onFilterChange: (filter: ReviewFilter) => void;
    getReviewForIndex: (index: number) => QuestionReview | undefined;
}

// =============================================================================
// Component
// =============================================================================

export function QuestionList({
    questions,
    reviews,
    reviewSummary,
    selectionMode,
    selectedIndices,
    filter,
    filteredIndices,
    onToggleSelection,
    onSelectAll,
    onDeselectAll,
    onFilterChange,
    getReviewForIndex,
}: QuestionListProps) {
    return (
        <div className="space-y-3">
            {/* Header with selection controls */}
            <div className="flex items-center justify-between">
                <h4 className="font-medium">
                    Generated Questions ({selectedIndices.size}/{questions.length} selected)
                </h4>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onSelectAll}
                        disabled={selectedIndices.size === questions.length}
                    >
                        <CheckSquare className="mr-1 h-3 w-3" />
                        All
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onDeselectAll}
                        disabled={selectedIndices.size === 0}
                    >
                        <Square className="mr-1 h-3 w-3" />
                        None
                    </Button>
                </div>
            </div>

            {/* Filter Buttons */}
            {reviews.length > 0 && (
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onFilterChange('all')}
                    >
                        <Filter className="mr-1 h-3 w-3" />
                        All ({questions.length})
                    </Button>
                    <Button
                        type="button"
                        variant={filter === 'pass' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onFilterChange('pass')}
                        className={filter === 'pass' ? '' : 'text-green-600 hover:text-green-700'}
                    >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Passed ({reviewSummary?.passed || 0})
                    </Button>
                    <Button
                        type="button"
                        variant={filter === 'flag' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onFilterChange('flag')}
                        className={filter === 'flag' ? '' : 'text-yellow-600 hover:text-yellow-700'}
                    >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Flagged ({reviewSummary?.flagged || 0})
                    </Button>
                    <Button
                        type="button"
                        variant={filter === 'reject' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onFilterChange('reject')}
                        className={filter === 'reject' ? '' : 'text-red-600 hover:text-red-700'}
                    >
                        <XCircle className="mr-1 h-3 w-3" />
                        Rejected ({reviewSummary?.rejected || 0})
                    </Button>
                </div>
            )}

            {/* Question List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredIndices.map((i) => (
                    <QuestionItem
                        key={i}
                        index={i}
                        question={questions[i]}
                        review={getReviewForIndex(i)}
                        selectionMode={selectionMode}
                        isSelected={selectedIndices.has(i)}
                        onToggle={() => onToggleSelection(i)}
                    />
                ))}
            </div>
        </div>
    );
}

// =============================================================================
// Question Item
// =============================================================================

interface QuestionItemProps {
    index: number;
    question: GeneratedQuestion;
    review: QuestionReview | undefined;
    selectionMode: CouncilSelectionMode;
    isSelected: boolean;
    onToggle: () => void;
}

function QuestionItem({
    question,
    review,
    selectionMode,
    isSelected,
    onToggle,
}: QuestionItemProps) {
    const isRejected = review?.verdict === 'reject';

    return (
        <div
            className={`rounded-lg border bg-card p-3 text-sm cursor-pointer transition-colors ${
                isRejected
                    ? 'opacity-50 border-red-300 bg-red-50/50 dark:bg-red-950/20'
                    : isSelected
                        ? 'border-primary ring-1 ring-primary/20'
                        : 'opacity-60 hover:opacity-80'
            }`}
            onClick={onToggle}
        >
            <div className="flex items-start gap-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggle}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                />
                <div className="flex-1 space-y-2">
                    <div>
                        <p>{question.text}</p>
                        {question.partner_text && (
                            <p className="text-muted-foreground text-xs mt-1">
                                Partner: {question.partner_text}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Source Generator Badge (cherry-pick mode) */}
                        {selectionMode === 'cherry_pick' && question.sourceGeneratorModel && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <Bot className="h-3 w-3" />
                                {question.sourceGeneratorModel.split('/').pop()}
                            </span>
                        )}

                        {/* Review Verdict Badge */}
                        {review && (
                            <span
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                                    review.verdict === 'pass'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : review.verdict === 'flag'
                                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}
                                title={review.scores
                                    ? `Scores: ${review.scores.guidelineCompliance}/${review.scores.creativity}/${review.scores.clarity}`
                                    : ''
                                }
                            >
                                {review.verdict === 'pass' && <CheckCircle2 className="h-3 w-3" />}
                                {review.verdict === 'flag' && <AlertTriangle className="h-3 w-3" />}
                                {review.verdict === 'reject' && <XCircle className="h-3 w-3" />}
                                {review.verdict.toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* Review Issues/Suggestions */}
                    {review && ((review.issues && review.issues.length > 0) || review.suggestions) && (
                        <div className="text-xs space-y-1 pt-1 border-t border-dashed">
                            {review.issues && review.issues.length > 0 && (
                                <ul className="list-disc list-inside text-muted-foreground">
                                    {review.issues.map((issue, idx) => (
                                        <li key={idx}>{issue}</li>
                                    ))}
                                </ul>
                            )}
                            {review.suggestions && (
                                <p className="text-blue-600 dark:text-blue-400">
                                    Suggestion: {review.suggestions}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
