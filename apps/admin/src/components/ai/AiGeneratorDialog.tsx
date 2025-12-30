import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, RefreshCw, Check, CheckSquare, Square } from 'lucide-react';
import { generatePack, generateQuestions, suggestCategories, suggestPacks, TONE_LEVELS, INTENSITY_LEVELS, type GeneratedPack, type GeneratedQuestion, type GeneratedCategoryIdea, type GeneratedPackIdea, type ToneLevel } from '@/lib/openai';
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
    const [count, setCount] = useState(10);
    // Default tone based on pack's explicit flag (5 for explicit packs, 3 for non-explicit)
    const [tone, setTone] = useState<ToneLevel>(context?.isExplicit ? 5 : 3);
    const isExplicit = tone >= 4; // For other generators that still use boolean

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

    // Selection state for questions
    const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Set<number>>(new Set());

    const handleGenerate = async () => {
        setLoading(true);
        try {
            if (type === 'pack') {
                const result = await generatePack(context?.categoryName, isExplicit);
                setGeneratedPack(result);
            } else if (type === 'questions') {
                if (!context?.packName) {
                    toast.error('Pack name is required');
                    return;
                }
                const result = await generateQuestions(context.packName, count, undefined, tone, context.packDescription || undefined, context.existingQuestions);
                setGeneratedQuestions(result);
                // Select all questions by default
                setSelectedQuestionIndices(new Set(result.map((_, i) => i)));
            } else if (type === 'category-ideas') {
                const result = await suggestCategories(context?.existingCategories || [], isExplicit);
                setGeneratedIdeas(result);
            } else if (type === 'category-pack-ideas') {
                if (!context?.categoryName) {
                    toast.error('Category name is required');
                    return;
                }
                const result = await suggestPacks(context.categoryName, context?.existingPacks || [], isExplicit);
                setGeneratedPackIdeas(result);
            }
        } catch (error) {
            console.error('AI generation error:', error);
            toast.error('Failed to generate content. Check your OpenAI API key.');
        } finally {
            setLoading(false);
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

                    {/* Tone Selector for Questions */}
                    {type === 'questions' && (
                        <div className="space-y-2">
                            <Label>Content Tone</Label>
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

                    {/* Explicit Toggle for other generators */}
                    {(type === 'category-ideas' || type === 'category-pack-ideas' || type === 'pack') && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="explicit-mode"
                                checked={isExplicit}
                                onCheckedChange={(checked) => setTone(checked ? 5 : 3)}
                            />
                            <Label htmlFor="explicit-mode">Suggest Explicit Ideas</Label>
                        </div>
                    )}

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
                        <Button onClick={handleGenerate} disabled={loading} className="w-full">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Generate with AI
                                </>
                            )}
                        </Button>
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
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {generatedQuestions.map((q, i) => (
                                    <div
                                        key={i}
                                        className={`rounded-lg border bg-card p-3 text-sm cursor-pointer transition-colors ${
                                            selectedQuestionIndices.has(i)
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
                                            <div className="flex-1">
                                                <p>{q.text}</p>
                                                {q.partner_text && (
                                                    <p className="text-muted-foreground text-xs mt-1">
                                                        Partner: {q.partner_text}
                                                    </p>
                                                )}
                                                <span
                                                    className={`inline-block mt-1 text-xs px-2 py-0.5 rounded text-white ${INTENSITY_LEVELS[q.intensity - 1]?.color || 'bg-muted'}`}
                                                    title={INTENSITY_LEVELS[q.intensity - 1]?.description}
                                                >
                                                    {q.intensity} - {INTENSITY_LEVELS[q.intensity - 1]?.label || 'Unknown'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
