import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react';
import { generatePack, generateQuestions, suggestCategories, suggestPacks, type GeneratedPack, type GeneratedQuestion, type GeneratedCategoryIdea, type GeneratedPackIdea } from '@/lib/openai';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface AiGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: 'pack' | 'questions' | 'category-ideas' | 'category-pack-ideas';
    context?: {
        categoryName?: string;
        packName?: string;
        existingCategories?: string[];
        existingPacks?: string[];
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
    const [isExplicit, setIsExplicit] = useState(false);

    // Generated results
    const [generatedPack, setGeneratedPack] = useState<GeneratedPack | null>(null);
    const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
    const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedCategoryIdea[]>([]);
    const [generatedPackIdeas, setGeneratedPackIdeas] = useState<GeneratedPackIdea[]>([]);

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
                const result = await generateQuestions(context.packName, count, undefined, isExplicit);
                setGeneratedQuestions(result);
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
            onGenerated(generatedQuestions);
        }
    };

    const handleClose = () => {
        // Reset state
        setGeneratedPack(null);
        setGeneratedQuestions([]);
        setGeneratedIdeas([]);
        setGeneratedPackIdeas([]);
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

                    {/* Explicit Toggle */}
                    {(type === 'category-ideas' || type === 'category-pack-ideas' || type === 'pack' || type === 'questions') && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="explicit-mode"
                                checked={isExplicit}
                                onCheckedChange={setIsExplicit}
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
                        <div className="rounded-md bg-muted p-3 text-sm">
                            <strong>Pack:</strong> {context.packName}
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
                            <h4 className="font-medium">Generated Questions ({generatedQuestions.length})</h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {generatedQuestions.map((q, i) => (
                                    <div key={i} className="rounded-lg border bg-card p-3 text-sm">
                                        <p>{q.text}</p>
                                        {q.partner_text && (
                                            <p className="text-muted-foreground text-xs mt-1">
                                                Partner: {q.partner_text}
                                            </p>
                                        )}
                                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-muted">
                                            {q.intensity} - {['Light', 'Mild', 'Moderate', 'Spicy', 'Very Intense'][q.intensity - 1]}
                                        </span>
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
                                            <span className="font-medium">{idea.name}</span>
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
                                <Button onClick={handleUse}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Use This
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
