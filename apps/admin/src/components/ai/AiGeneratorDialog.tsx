import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

// Extracted components
import { useAiGeneration, type GeneratorType, type GeneratorContext } from './hooks/useAiGeneration';
import { GenerationForm } from './GenerationForm';
import { GenerationProgressDisplay } from './GenerationProgress';
import { ReviewSummary, ModelBadge } from './ReviewSummary';
import { QuestionList } from './QuestionList';
import { CategoryIdeasList, PackIdeasList } from './IdeasList';
import { PackPreview } from './PackPreview';

// =============================================================================
// Types
// =============================================================================

interface AiGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: GeneratorType;
    context?: GeneratorContext;
    onGenerated: (result: any) => void;
}

// =============================================================================
// Component
// =============================================================================

export function AiGeneratorDialog({
    open,
    onOpenChange,
    type,
    context,
    onGenerated,
}: AiGeneratorDialogProps) {
    const generation = useAiGeneration(type, context);

    // Reset when dialog closes
    useEffect(() => {
        if (!open) {
            generation.reset();
        }
    }, [open]);

    const handleClose = () => {
        generation.reset();
        onOpenChange(false);
    };

    const handleUse = () => {
        if (type === 'pack' && generation.results.pack) {
            onGenerated(generation.results.pack);
        } else if (type === 'questions' && generation.results.questions.length > 0) {
            const selectedQuestions = generation.results.questions.filter(
                (_, i) => generation.selectedIndices.has(i)
            );
            if (selectedQuestions.length === 0) {
                toast.error('Please select at least one question');
                return;
            }
            onGenerated(selectedQuestions);
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'pack': return 'Pack';
            case 'questions': return 'Question';
            case 'category-pack-ideas': return 'Pack Ideas';
            default: return 'Category';
        }
    };

    const getDescription = () => {
        switch (type) {
            case 'pack':
                return 'Generate a creative question pack name and description using AI.';
            case 'questions':
                return 'Generate multiple questions for this pack using AI.';
            case 'category-pack-ideas':
                return 'Generate unique pack ideas for this category.';
            default:
                return 'Get creative category ideas based on your existing ones.';
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI {getTitle()} Generator
                    </DialogTitle>
                    <DialogDescription>
                        {getDescription()}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Configuration Form */}
                    <GenerationForm
                        type={type}
                        context={context}
                        config={generation.config}
                        onCountChange={generation.setCount}
                        onInspirationChange={generation.setInspiration}
                    />

                    {/* Generate Button (only when no results) */}
                    {!generation.hasResults && (
                        <div className="space-y-3">
                            <Button
                                onClick={generation.generate}
                                disabled={generation.loading}
                                className="w-full"
                            >
                                {generation.loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {generation.progress?.message || 'Generating...'}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate with AI
                                    </>
                                )}
                            </Button>

                            {/* Generation Progress */}
                            {generation.loading && generation.progress && (
                                <GenerationProgressDisplay
                                    progress={generation.progress}
                                    councilConfig={generation.councilConfig}
                                />
                            )}

                            {/* Council info */}
                            {generation.councilConfig.enabled && type === 'questions' && !generation.loading && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Council mode: {generation.councilConfig.generators.length} generator
                                    {generation.councilConfig.generators.length > 1 ? 's' : ''} + reviewer
                                    {generation.councilConfig.generators.length > 1 && ' (best output will be selected)'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Generated Pack Preview */}
                    {generation.results.pack && (
                        <PackPreview
                            pack={generation.results.pack}
                            sourceModel={generation.sourceModel}
                        />
                    )}

                    {/* Generated Questions Preview */}
                    {generation.results.questions.length > 0 && (
                        <>
                            {/* Simple model badge when council is disabled */}
                            {!generation.reviewState.summary && generation.reviewState.metadata && (
                                <ModelBadge
                                    model={generation.reviewState.metadata.generatorModels[0]}
                                    generationTime={generation.reviewState.metadata.totalGenerationTime}
                                />
                            )}

                            {/* Review Summary */}
                            <ReviewSummary
                                summary={generation.reviewState.summary}
                                metadata={generation.reviewState.metadata}
                                selectionMode={generation.reviewState.selectionMode}
                                allCandidates={generation.reviewState.allCandidates}
                                selectedGeneratorIndex={generation.reviewState.selectedGeneratorIndex}
                                cherryPickResult={generation.reviewState.cherryPickResult}
                            />

                            {/* Question List */}
                            <QuestionList
                                questions={generation.results.questions}
                                reviews={generation.reviewState.reviews}
                                reviewSummary={generation.reviewState.summary}
                                selectionMode={generation.reviewState.selectionMode}
                                selectedIndices={generation.selectedIndices}
                                filter={generation.filter}
                                filteredIndices={generation.getFilteredQuestionIndices()}
                                onToggleSelection={generation.toggleSelection}
                                onSelectAll={generation.selectAll}
                                onDeselectAll={generation.deselectAll}
                                onFilterChange={generation.setFilter}
                                getReviewForIndex={generation.getReviewForIndex}
                            />
                        </>
                    )}

                    {/* Generated Category Ideas */}
                    <CategoryIdeasList
                        ideas={generation.results.categoryIdeas}
                        sourceModel={generation.sourceModel}
                        onSelectIdea={onGenerated}
                    />

                    {/* Generated Pack Ideas */}
                    <PackIdeasList
                        ideas={generation.results.packIdeas}
                        sourceModel={generation.sourceModel}
                        onSelectIdea={onGenerated}
                    />
                </div>

                <DialogFooter>
                    {generation.hasResults && (
                        <>
                            <Button
                                variant="outline"
                                onClick={generation.generate}
                                disabled={generation.loading}
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${generation.loading ? 'animate-spin' : ''}`} />
                                Regenerate
                            </Button>
                            {type !== 'category-ideas' && type !== 'category-pack-ideas' && (
                                <Button
                                    onClick={handleUse}
                                    disabled={type === 'questions' && generation.selectedIndices.size === 0}
                                >
                                    <Check className="mr-2 h-4 w-4" />
                                    {type === 'questions'
                                        ? `Use Selected (${generation.selectedIndices.size})`
                                        : 'Use This'
                                    }
                                </Button>
                            )}
                        </>
                    )}
                    {!generation.hasResults && (
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
