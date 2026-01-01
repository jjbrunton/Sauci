import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, RefreshCw, Check, CheckSquare, Square, AlertTriangle, XCircle, CheckCircle2, Filter } from 'lucide-react';
import {
    generatePack,
    generateQuestionsWithCouncil,
    suggestCategories,
    suggestPacks,
    getCouncilConfig,
    TONE_LEVELS,
    INTENSITY_LEVELS,
    type GeneratedPack,
    type GeneratedQuestion,
    type GeneratedCategoryIdea,
    type GeneratedPackIdea,
    type ToneLevel,
    type QuestionReview,
    type CouncilGenerationResult,
    type GenerationCandidate,
} from '@/lib/openai';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface AiGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: 'pack' | 'questions' | 'category-ideas' | 'category-pack-ideas';
    context?: {
        categoryName?: string;
        packName?: string;
        packDescription?: string | null;
        existingCategories?: string[];
        existingPacks?: string[];
        existingQuestions?: string[];
        isExplicit?: boolean;
    };
    onGenerated: (result: any) => void;
}

export function AiGeneratorDialog({
    open,
    onOpenChange,
    type,
    context,
    onGenerated,
}: AiGeneratorDialogProps) {
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState<'generating' | 'reviewing' | null>(null);
    const [count, setCount] = useState(10);
    // Default tone based on pack's explicit flag (5 for explicit packs, 3 for non-explicit)
    const [tone, setTone] = useState<ToneLevel>(context?.isExplicit ? 5 : 3);
    const isExplicit = tone >= 4; // For other generators that still use boolean
    const [crudeLang, setCrudeLang] = useState(false);
    const [inspiration, setInspiration] = useState('');

    // Update tone when dialog opens with new context
    useEffect(() => {
        if (open && type === 'questions') {
            setTone(context?.isExplicit ? 5 : 3);
        }
    }, [open, context?.isExplicit, type]);

    // Generated results
    const [generatedPack, setGeneratedPack] = useState<GeneratedPack | null>(null);
    const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
    const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedCategoryIdea[]>([]);
    const [generatedPackIdeas, setGeneratedPackIdeas] = useState<GeneratedPackIdea[]>([]);

    // Council review state
    const [reviews, setReviews] = useState<QuestionReview[]>([]);
    const [reviewSummary, setReviewSummary] = useState<CouncilGenerationResult['summary']>(null);
    const [reviewMetadata, setReviewMetadata] = useState<CouncilGenerationResult['metadata'] | null>(null);
    const [selectedGeneratorIndex, setSelectedGeneratorIndex] = useState<number | null>(null);
    const [allCandidates, setAllCandidates] = useState<GenerationCandidate[] | null>(null);
    const [filter, setFilter] = useState<'all' | 'pass' | 'flag' | 'reject'>('all');

    // Selection state for questions
    const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Set<number>>(new Set());

    // Get council config
    const councilConfig = getCouncilConfig();

    // Helper to get review for a question index
    const getReviewForIndex = (index: number): QuestionReview | undefined => {
        if (!reviews || reviews.length === 0) return undefined;
        return reviews.find(r => r.index === index);
    };

    // Filter questions based on current filter
    const getFilteredQuestionIndices = (): number[] => {
        if (!generatedQuestions || generatedQuestions.length === 0) {
            return [];
        }
        if (filter === 'all' || !reviews || reviews.length === 0) {
            return generatedQuestions.map((_, i) => i);
        }
        return reviews
            .filter(r => r.verdict === filter)
            .map(r => r.index);
    };

    const handleGenerate = async () => {
        setLoading(true);
        setLoadingStep(null);
        // Reset council state
        setReviews([]);
        setReviewSummary(null);
        setReviewMetadata(null);
        setSelectedGeneratorIndex(null);
        setAllCandidates(null);
        setFilter('all');

        try {
            if (type === 'pack') {
                const result = await generatePack(context?.categoryName, isExplicit, crudeLang, inspiration || undefined);
                setGeneratedPack(result);
            } else if (type === 'questions') {
                if (!context?.packName) {
                    toast.error('Pack name is required');
                    return;
                }

                // Use council approach
                setLoadingStep('generating');
                const result = await generateQuestionsWithCouncil(
                    context.packName,
                    count,
                    undefined,
                    tone,
                    context.packDescription || undefined,
                    context.existingQuestions,
                    crudeLang,
                    inspiration || undefined
                );

                const questions = result.questions || [];
                const reviewList = result.reviews || [];

                setGeneratedQuestions(questions);
                setReviews(reviewList);
                setReviewSummary(result.summary);
                setReviewMetadata(result.metadata);
                setSelectedGeneratorIndex(result.selectedGeneratorIndex);
                setAllCandidates(result.allCandidates);

                // Smart selection based on review results
                if (reviewList.length > 0) {
                    // Select passed and flagged questions by default, not rejected
                    const selectedIndices = new Set<number>();
                    reviewList.forEach(r => {
                        if (r.verdict === 'pass' || r.verdict === 'flag') {
                            selectedIndices.add(r.index);
                        }
                    });
                    setSelectedQuestionIndices(selectedIndices);

                    // Show toast with summary
                    if (result.summary) {
                        const { passed, flagged, rejected } = result.summary;
                        const generatorInfo = allCandidates && allCandidates.length > 1 && result.selectedGeneratorIndex !== null
                            ? ` (from generator ${result.selectedGeneratorIndex + 1})`
                            : '';
                        if (rejected > 0) {
                            toast.warning(`Review complete: ${passed} passed, ${flagged} flagged, ${rejected} rejected${generatorInfo}`);
                        } else {
                            toast.success(`Review complete: ${passed} passed, ${flagged} flagged${generatorInfo}`);
                        }
                    }
                } else {
                    // No review (council disabled or failed) - select all
                    setSelectedQuestionIndices(new Set(questions.map((_, i) => i)));
                    if (councilConfig.enabled && !result.metadata?.reviewerModel) {
                        toast.warning('Council review failed - showing unreviewed questions');
                    }
                }
            } else if (type === 'category-ideas') {
                const result = await suggestCategories(context?.existingCategories || [], isExplicit, crudeLang, inspiration || undefined);
                setGeneratedIdeas(result);
            } else if (type === 'category-pack-ideas') {
                if (!context?.categoryName) {
                    toast.error('Category name is required');
                    return;
                }
                const result = await suggestPacks(context.categoryName, context?.existingPacks || [], isExplicit, crudeLang, inspiration || undefined);
                setGeneratedPackIdeas(result);
            }
        } catch (error) {
            console.error('AI generation error:', error);
            toast.error('Failed to generate content. Check your API key.');
        } finally {
            setLoading(false);
            setLoadingStep(null);
        }
    };

    const handleUse = () => {
        if (type === 'pack' && generatedPack) {
            onGenerated(generatedPack);
        } else if (type === 'questions' && generatedQuestions.length > 0) {
            // Only pass selected questions
            const selectedQuestions = generatedQuestions.filter((_, i) => selectedQuestionIndices.has(i));
            if (selectedQuestions.length === 0) {
                toast.error('Please select at least one question');
                return;
            }
            onGenerated(selectedQuestions);
        }
    };

    const toggleQuestionSelection = (index: number) => {
        setSelectedQuestionIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const selectAllQuestions = () => {
        setSelectedQuestionIndices(new Set(generatedQuestions.map((_, i) => i)));
    };

    const deselectAllQuestions = () => {
        setSelectedQuestionIndices(new Set());
    };

    const handleClose = () => {
        // Reset state
        setGeneratedPack(null);
        setGeneratedQuestions([]);
        setGeneratedIdeas([]);
        setGeneratedPackIdeas([]);
        setSelectedQuestionIndices(new Set());
        setCrudeLang(false);
        setInspiration('');
        // Reset council state
        setReviews([]);
        setReviewSummary(null);
        setReviewMetadata(null);
        setSelectedGeneratorIndex(null);
        setAllCandidates(null);
        setFilter('all');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI {type === 'pack' ? 'Pack' : type === 'questions' ? 'Question' : type === 'category-pack-ideas' ? 'Pack Ideas' : 'Category'} Generator
                    </DialogTitle>
                    <DialogDescription>
                        {type === 'pack'
                            ? 'Generate a creative question pack name and description using AI.'
                            : type === 'questions'
                                ? 'Generate multiple questions for this pack using AI.'
                                : type === 'category-pack-ideas'
                                    ? 'Generate unique pack ideas for this category.'
                                    : 'Get creative category ideas based on your existing ones.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Configuration */}
                    {type === 'questions' && (
                        <div className="space-y-2">
                            <Label htmlFor="count">Number of Questions</Label>
                            <Input
                                id="count"
                                type="number"
                                min={1}
                                max={50}
                                value={count}
                                onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                                className="w-32"
                            />
                        </div>
                    )}

                    {/* Wildness Level Selector for Questions */}
                    {type === 'questions' && (
                        <div className="space-y-2">
                            <Label>Wildness Level</Label>
                            <div className="flex flex-wrap gap-2">
                                {TONE_LEVELS.map((t) => (
                                    <Button
                                        key={t.level}
                                        type="button"
                                        variant={tone === t.level ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setTone(t.level as ToneLevel)}
                                        className={tone === t.level ? 'ring-2 ring-offset-1' : ''}
                                        title={t.description}
                                    >
                                        {t.level}. {t.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {TONE_LEVELS.find(t => t.level === tone)?.description}
                            </p>
                        </div>
                    )}

                    {/* Wild/Explicit Toggle for other generators */}
                    {(type === 'category-ideas' || type === 'category-pack-ideas' || type === 'pack') && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="explicit-mode"
                                checked={isExplicit}
                                onCheckedChange={(checked) => setTone(checked ? 5 : 3)}
                            />
                            <Label htmlFor="explicit-mode">Include Wild/Adult Ideas</Label>
                        </div>
                    )}

                    {/* Crude Language Override Toggle */}
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="crude-lang"
                            checked={crudeLang}
                            onCheckedChange={setCrudeLang}
                        />
                        <Label htmlFor="crude-lang">Crude Language Override</Label>
                        <span className="text-xs text-muted-foreground">(use "fuck", "suck cock" etc. instead of tasteful phrasing)</span>
                    </div>

                    {/* Inspiration/Suggestions Textarea */}
                    <div className="space-y-2">
                        <Label htmlFor="inspiration">Inspiration / Suggestions (optional)</Label>
                        <Textarea
                            id="inspiration"
                            placeholder="Provide any themes, ideas, or guidance for the AI to consider..."
                            value={inspiration}
                            onChange={(e) => setInspiration(e.target.value)}
                            rows={3}
                            className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            Add freetext suggestions to guide the AI generation
                        </p>
                    </div>

                    {/* Context info */}
                    {context?.categoryName && (
                        <div className="rounded-md bg-muted p-3 text-sm">
                            <strong>Category:</strong> {context.categoryName}
                        </div>
                    )}
                    {context?.packName && (
                        <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                            <div><strong>Pack:</strong> {context.packName}</div>
                            {context.packDescription && (
                                <div className="text-muted-foreground text-xs">{context.packDescription}</div>
                            )}
                        </div>
                    )}

                    {/* Generate button */}
                    {!generatedPack && generatedQuestions.length === 0 && generatedIdeas.length === 0 && generatedPackIdeas.length === 0 && (
                        <div className="space-y-2">
                            <Button onClick={handleGenerate} disabled={loading} className="w-full">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {loadingStep === 'generating' && councilConfig.enabled
                                            ? `Step 1/2: Generating${councilConfig.generators.length > 1 ? ` with ${councilConfig.generators.length} models` : ''}...`
                                            : loadingStep === 'reviewing'
                                                ? 'Step 2/2: Reviewing & selecting best...'
                                                : 'Generating...'}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate with AI
                                    </>
                                )}
                            </Button>
                            {councilConfig.enabled && type === 'questions' && !loading && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Council mode: {councilConfig.generators.length} generator{councilConfig.generators.length > 1 ? 's' : ''} + reviewer
                                    {councilConfig.generators.length > 1 && ' (best output will be selected)'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Generated Pack Preview */}
                    {generatedPack && (
                        <div className="space-y-3">
                            <h4 className="font-medium">Generated Pack</h4>
                            <div className="rounded-lg border bg-card p-4 space-y-2">
                                <p className="font-semibold text-lg">{generatedPack.name}</p>
                                <p className="text-muted-foreground">{generatedPack.description}</p>
                            </div>
                        </div>
                    )}

                    {/* Generated Questions Preview */}
                    {generatedQuestions.length > 0 && (
                        <div className="space-y-3">
                            {/* Review Summary Bar */}
                            {reviewSummary && (
                                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="flex items-center gap-1 text-green-600">
                                                <CheckCircle2 className="h-4 w-4" />
                                                {reviewSummary.passed} Passed
                                            </span>
                                            <span className="flex items-center gap-1 text-yellow-600">
                                                <AlertTriangle className="h-4 w-4" />
                                                {reviewSummary.flagged} Flagged
                                            </span>
                                            <span className="flex items-center gap-1 text-red-600">
                                                <XCircle className="h-4 w-4" />
                                                {reviewSummary.rejected} Rejected
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium">
                                            Quality: {reviewSummary.overallQuality}/10
                                        </span>
                                    </div>
                                    {reviewMetadata && (
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>
                                                Generated in {(reviewMetadata.totalGenerationTime / 1000).toFixed(1)}s
                                                {reviewMetadata.reviewTime > 0 && ` • Reviewed in ${(reviewMetadata.reviewTime / 1000).toFixed(1)}s`}
                                            </p>
                                            {allCandidates && allCandidates.length > 1 && selectedGeneratorIndex !== null && (
                                                <p className="text-primary font-medium">
                                                    Selected: Generator {selectedGeneratorIndex + 1} of {allCandidates.length}
                                                    {' '}({allCandidates[selectedGeneratorIndex]?.generatorModel.split('/').pop()})
                                                </p>
                                            )}
                                            {reviewMetadata.generatorModels.length > 1 && (
                                                <p>
                                                    Compared {reviewMetadata.generatorModels.length} generators: {reviewMetadata.generatorModels.map(m => m.split('/').pop()).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <h4 className="font-medium">
                                    Generated Questions ({selectedQuestionIndices.size}/{generatedQuestions.length} selected)
                                </h4>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={selectAllQuestions}
                                        disabled={selectedQuestionIndices.size === generatedQuestions.length}
                                    >
                                        <CheckSquare className="mr-1 h-3 w-3" />
                                        All
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={deselectAllQuestions}
                                        disabled={selectedQuestionIndices.size === 0}
                                    >
                                        <Square className="mr-1 h-3 w-3" />
                                        None
                                    </Button>
                                </div>
                            </div>

                            {/* Filter Buttons */}
                            {reviews && reviews.length > 0 && (
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={filter === 'all' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilter('all')}
                                    >
                                        <Filter className="mr-1 h-3 w-3" />
                                        All ({generatedQuestions.length})
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={filter === 'pass' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilter('pass')}
                                        className={filter === 'pass' ? '' : 'text-green-600 hover:text-green-700'}
                                    >
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Passed ({reviewSummary?.passed || 0})
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={filter === 'flag' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilter('flag')}
                                        className={filter === 'flag' ? '' : 'text-yellow-600 hover:text-yellow-700'}
                                    >
                                        <AlertTriangle className="mr-1 h-3 w-3" />
                                        Flagged ({reviewSummary?.flagged || 0})
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={filter === 'reject' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilter('reject')}
                                        className={filter === 'reject' ? '' : 'text-red-600 hover:text-red-700'}
                                    >
                                        <XCircle className="mr-1 h-3 w-3" />
                                        Rejected ({reviewSummary?.rejected || 0})
                                    </Button>
                                </div>
                            )}

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {getFilteredQuestionIndices().map((i) => {
                                    const q = generatedQuestions[i];
                                    const review = getReviewForIndex(i);
                                    const isRejected = review?.verdict === 'reject';

                                    return (
                                        <div
                                            key={i}
                                            className={`rounded-lg border bg-card p-3 text-sm cursor-pointer transition-colors ${
                                                isRejected
                                                    ? 'opacity-50 border-red-300 bg-red-50/50 dark:bg-red-950/20'
                                                    : selectedQuestionIndices.has(i)
                                                        ? 'border-primary ring-1 ring-primary/20'
                                                        : 'opacity-60 hover:opacity-80'
                                            }`}
                                            onClick={() => toggleQuestionSelection(i)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    checked={selectedQuestionIndices.has(i)}
                                                    onCheckedChange={() => toggleQuestionSelection(i)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1 space-y-2">
                                                    <div>
                                                        <p>{q.text}</p>
                                                        {q.partner_text && (
                                                            <p className="text-muted-foreground text-xs mt-1">
                                                                Partner: {q.partner_text}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            className={`inline-block text-xs px-2 py-0.5 rounded text-white ${INTENSITY_LEVELS[q.intensity - 1]?.color || 'bg-muted'}`}
                                                            title={INTENSITY_LEVELS[q.intensity - 1]?.description}
                                                        >
                                                            {q.intensity} - {INTENSITY_LEVELS[q.intensity - 1]?.label || 'Unknown'}
                                                        </span>

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
                                                                title={review.scores ? `Scores: ${review.scores.guidelineCompliance}/${review.scores.creativity}/${review.scores.clarity}/${review.scores.intensityAccuracy}` : ''}
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
                                })}
                            </div>
                        </div>
                    )}

                    {/* Generated Ideas Preview */}
                    {generatedIdeas.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-medium">Suggested Categories</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {generatedIdeas.map((idea, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                                        onClick={() => onGenerated(idea)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{idea.icon}</span>
                                            <div>
                                                <span className="font-medium block">{idea.name}</span>
                                                <span className="text-xs text-muted-foreground">{idea.description}</span>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost">Use</Button>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground text-center">Click an item to use it</p>
                        </div>
                    )}

                    {/* Generated Pack Ideas Preview */}
                    {generatedPackIdeas.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-medium">Suggested Packs</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {generatedPackIdeas.map((idea, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                                        onClick={() => onGenerated(idea)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{idea.icon}</span>
                                            <div>
                                                <span className="font-medium block">{idea.name}</span>
                                                <span className="text-xs text-muted-foreground">{idea.description}</span>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost">Use</Button>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground text-center">Click an item to use it</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {(generatedPack || generatedQuestions.length > 0 || generatedIdeas.length > 0 || generatedPackIdeas.length > 0) && (
                        <>
                            <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                Regenerate
                            </Button>
                            {type !== 'category-ideas' && type !== 'category-pack-ideas' && (
                                <Button onClick={handleUse} disabled={type === 'questions' && selectedQuestionIndices.size === 0}>
                                    <Check className="mr-2 h-4 w-4" />
                                    {type === 'questions' ? `Use Selected (${selectedQuestionIndices.size})` : 'Use This'}
                                </Button>
                            )}
                        </>
                    )}
                    {!generatedPack && generatedQuestions.length === 0 && generatedIdeas.length === 0 && generatedPackIdeas.length === 0 && (
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
