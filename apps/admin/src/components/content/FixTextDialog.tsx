import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Wand2, ArrowRight, Check } from 'lucide-react';
import { analyzeQuestionText, TextAnalysis } from '@/lib/openai';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { toast } from 'sonner';

interface Question {
    id: string;
    text: string;
    partner_text: string | null;
}

interface FixTextDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questions: Question[];
    isExplicit?: boolean;
    onUpdated: () => void;
}

export function FixTextDialog({ open, onOpenChange, questions, isExplicit = false, onUpdated }: FixTextDialogProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<TextAnalysis[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [step, setStep] = useState<'initial' | 'review'>('initial');
    const [applying, setApplying] = useState(false);

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            const results = await analyzeQuestionText(questions, isExplicit);
            setSuggestions(results);
            // Default select all
            setSelectedIds(new Set(results.map(r => r.id)));
            setStep('review');
        } catch (error) {
            console.error(error);
            toast.error('Failed to analyze questions');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleApply = async () => {
        setApplying(true);
        try {
            const updates = suggestions.filter(s => selectedIds.has(s.id));
            if (updates.length === 0) {
                onOpenChange(false);
                return;
            }

            // Apply updates in parallel with audit logging
            await Promise.all(updates.map(update =>
                auditedSupabase.update('questions', update.id, {
                    text: update.suggested_text,
                    partner_text: update.suggested_partner_text,
                })
            ));

            toast.success(`Updated ${updates.length} questions`);
            onUpdated();
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error('Failed to apply updates');
        } finally {
            setApplying(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset state after transition
        setTimeout(() => {
            setStep('initial');
            setSuggestions([]);
        }, 300);
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const getQuestion = (id: string) => questions.find(q => q.id === id);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-purple-500" />
                        Fix Question Text
                    </DialogTitle>
                    <DialogDescription>
                        Use AI to improve question phrasing to be direct, actionable proposals.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {step === 'initial' ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="bg-purple-500/20 p-4 rounded-full">
                                <Wand2 className="h-12 w-12 text-purple-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">Ready to analyze {questions.length} questions</h3>
                                <p className="text-muted-foreground max-w-md mx-auto">
                                    The AI will suggest improved text to make questions more direct and actionable,
                                    following the proposal style (e.g., "Give your partner a massage" instead of "Would you want to give a massage?").
                                </p>
                            </div>
                            <Button onClick={handleAnalyze} disabled={analyzing} size="lg" className="bg-purple-600 hover:bg-purple-700">
                                {analyzing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    'Start Analysis'
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {suggestions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                    All questions are well-phrased! No improvements needed.
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                                                        checked={selectedIds.size === suggestions.length && suggestions.length > 0}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedIds(new Set(suggestions.map(s => s.id)));
                                                            else setSelectedIds(new Set());
                                                        }}
                                                    />
                                                </TableHead>
                                                <TableHead>Current Text</TableHead>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>Suggested Text</TableHead>
                                                <TableHead>Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {suggestions.map((suggestion) => {
                                                const question = getQuestion(suggestion.id);
                                                if (!question) return null;
                                                return (
                                                    <TableRow key={suggestion.id}>
                                                        <TableCell>
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-gray-300 accent-primary"
                                                                checked={selectedIds.has(suggestion.id)}
                                                                onChange={() => toggleSelection(suggestion.id)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="max-w-xs">
                                                            <div className="text-sm">{question.text}</div>
                                                            {question.partner_text && (
                                                                <div className="text-xs text-muted-foreground mt-1 italic">
                                                                    Partner: {question.partner_text}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                        </TableCell>
                                                        <TableCell className="max-w-xs">
                                                            <div className="text-sm font-medium text-purple-300">{suggestion.suggested_text}</div>
                                                            {suggestion.suggested_partner_text && (
                                                                <div className="text-xs text-purple-400 mt-1 italic">
                                                                    Partner: {suggestion.suggested_partner_text}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground max-w-xs">
                                                            {suggestion.reason}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 'review' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('initial')}>
                                Back
                            </Button>
                            <Button
                                onClick={handleApply}
                                disabled={applying || suggestions.length === 0 || selectedIds.size === 0}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {applying ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Applying...
                                    </>
                                ) : (
                                    `Apply ${selectedIds.size} Fixes`
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
