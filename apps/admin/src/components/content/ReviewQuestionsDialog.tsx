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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Sparkles, ArrowRight, Check, Wand2, ShieldCheck } from 'lucide-react';
import { analyzeQuestionText, analyzeQuestionTargets, TextAnalysis, TargetAnalysis } from '@/lib/openai';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { toast } from 'sonner';

interface Question {
    id: string;
    text: string;
    partner_text: string | null;
    intensity: number;
    allowed_couple_genders: string[] | null;
    target_user_genders: string[] | null;
}

interface ReviewQuestionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questions: Question[];
    isExplicit?: boolean;
    onUpdated: () => void;
}

interface CombinedSuggestion {
    questionId: string;
    question: Question;
    textSuggestion?: TextAnalysis;
    targetSuggestion?: TargetAnalysis;
}

export function ReviewQuestionsDialog({ open, onOpenChange, questions, isExplicit = false, onUpdated }: ReviewQuestionsDialogProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<CombinedSuggestion[]>([]);
    const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
    const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
    const [step, setStep] = useState<'initial' | 'review'>('initial');
    const [applying, setApplying] = useState(false);

    // Helper functions for target comparison
    const isAllCoupleTargets = (targets: string[] | null): boolean => {
        if (!targets || targets.length === 0) return true;
        if (targets.length === 3) {
            const sorted = [...targets].sort();
            return sorted[0] === 'female+female' && sorted[1] === 'female+male' && sorted[2] === 'male+male';
        }
        return false;
    };

    const isAllInitiator = (targets: string[] | null): boolean => {
        return !targets || targets.length === 0;
    };

    const arraysEqual = (a: string[] | null, b: string[] | null): boolean => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, i) => val === sortedB[i]);
    };

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            // Run both analyses in parallel
            const [textResults, targetResults] = await Promise.all([
                analyzeQuestionText(questions, isExplicit),
                analyzeQuestionTargets(questions)
            ]);

            // Filter target results to only meaningful changes
            const meaningfulTargetResults = targetResults.filter(suggestion => {
                const question = questions.find(q => q.id === suggestion.id);
                if (!question) return false;

                const currentCoupleIsAll = isAllCoupleTargets(question.allowed_couple_genders);
                const suggestedCoupleIsAll = isAllCoupleTargets(suggestion.suggested_targets);
                const coupleChanged = !(currentCoupleIsAll && suggestedCoupleIsAll) &&
                    !arraysEqual(question.allowed_couple_genders, suggestion.suggested_targets);

                const currentInitiatorIsAll = isAllInitiator(question.target_user_genders);
                const suggestedInitiatorIsAll = isAllInitiator(suggestion.suggested_initiator);
                const initiatorChanged = !(currentInitiatorIsAll && suggestedInitiatorIsAll) &&
                    !arraysEqual(question.target_user_genders, suggestion.suggested_initiator);

                return coupleChanged || initiatorChanged;
            });

            // Combine results by question ID
            const questionIds = new Set([
                ...textResults.map(t => t.id),
                ...meaningfulTargetResults.map(t => t.id)
            ]);

            const combined: CombinedSuggestion[] = Array.from(questionIds).map(id => {
                const question = questions.find(q => q.id === id)!;
                return {
                    questionId: id,
                    question,
                    textSuggestion: textResults.find(t => t.id === id),
                    targetSuggestion: meaningfulTargetResults.find(t => t.id === id),
                };
            });

            setSuggestions(combined);
            // Default select all
            setSelectedTextIds(new Set(textResults.map(r => r.id)));
            setSelectedTargetIds(new Set(meaningfulTargetResults.map(r => r.id)));
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
            const updates: { id: string; data: Record<string, unknown> }[] = [];

            // Build update objects combining text and target changes
            suggestions.forEach(suggestion => {
                const textSelected = selectedTextIds.has(suggestion.questionId) && suggestion.textSuggestion;
                const targetSelected = selectedTargetIds.has(suggestion.questionId) && suggestion.targetSuggestion;

                if (textSelected || targetSelected) {
                    const updateData: Record<string, unknown> = {};

                    if (textSelected && suggestion.textSuggestion) {
                        updateData.text = suggestion.textSuggestion.suggested_text;
                        updateData.partner_text = suggestion.textSuggestion.suggested_partner_text;
                    }

                    if (targetSelected && suggestion.targetSuggestion) {
                        updateData.allowed_couple_genders = suggestion.targetSuggestion.suggested_targets &&
                            suggestion.targetSuggestion.suggested_targets.length > 0
                            ? suggestion.targetSuggestion.suggested_targets
                            : null;
                        updateData.target_user_genders = suggestion.targetSuggestion.suggested_initiator &&
                            suggestion.targetSuggestion.suggested_initiator.length > 0
                            ? suggestion.targetSuggestion.suggested_initiator
                            : null;
                    }

                    if (Object.keys(updateData).length > 0) {
                        updates.push({ id: suggestion.questionId, data: updateData });
                    }
                }
            });

            if (updates.length === 0) {
                onOpenChange(false);
                return;
            }

            // Apply updates in parallel with audit logging
            await Promise.all(updates.map(update =>
                auditedSupabase.update('questions', update.id, update.data)
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
        setTimeout(() => {
            setStep('initial');
            setSuggestions([]);
            setSelectedTextIds(new Set());
            setSelectedTargetIds(new Set());
        }, 300);
    };

    const toggleTextSelection = (id: string) => {
        const next = new Set(selectedTextIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedTextIds(next);
    };

    const toggleTargetSelection = (id: string) => {
        const next = new Set(selectedTargetIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedTargetIds(next);
    };

    const formatTargets = (targets: string[] | null) => {
        if (!targets || targets.length === 0) return 'All';
        return targets.map(t => t.replace('male+male', 'M+M').replace('female+male', 'M+F').replace('female+female', 'F+F')).join(', ');
    };

    const formatInitiator = (targets: string[] | null) => {
        if (!targets || targets.length === 0) return 'Any';
        return targets.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
    };

    // Count suggestions by type
    const textSuggestionCount = suggestions.filter(s => s.textSuggestion).length;
    const targetSuggestionCount = suggestions.filter(s => s.targetSuggestion).length;
    const totalSelectedCount = selectedTextIds.size + selectedTargetIds.size;

    // Select all/none helpers
    const selectAllText = () => setSelectedTextIds(new Set(suggestions.filter(s => s.textSuggestion).map(s => s.questionId)));
    const selectNoneText = () => setSelectedTextIds(new Set());
    const selectAllTargets = () => setSelectedTargetIds(new Set(suggestions.filter(s => s.targetSuggestion).map(s => s.questionId)));
    const selectNoneTargets = () => setSelectedTargetIds(new Set());
    const selectAll = () => {
        selectAllText();
        selectAllTargets();
    };
    const selectNone = () => {
        selectNoneText();
        selectNoneTargets();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Review Questions
                    </DialogTitle>
                    <DialogDescription>
                        AI-powered analysis to improve text phrasing and fix audience targeting.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {step === 'initial' ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                            <div className="bg-amber-500/20 p-4 rounded-full">
                                <Sparkles className="h-12 w-12 text-amber-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">Ready to analyze {questions.length} questions</h3>
                                <p className="text-muted-foreground max-w-lg mx-auto">
                                    The AI will analyze all questions and suggest improvements for:
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 bg-purple-500/20 px-4 py-2 rounded-lg">
                                    <Wand2 className="h-5 w-5 text-purple-400" />
                                    <span className="text-sm font-medium text-purple-300">Text Phrasing</span>
                                </div>
                                <div className="flex items-center gap-2 bg-indigo-500/20 px-4 py-2 rounded-lg">
                                    <ShieldCheck className="h-5 w-5 text-indigo-400" />
                                    <span className="text-sm font-medium text-indigo-300">Audience Targeting</span>
                                </div>
                            </div>
                            <Button onClick={handleAnalyze} disabled={analyzing} size="lg" className="bg-amber-600 hover:bg-amber-700">
                                {analyzing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    'Start Review'
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {suggestions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                    All questions look great! No improvements needed.
                                </div>
                            ) : (
                                <>
                                    {/* Summary and bulk actions */}
                                    <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="flex items-center gap-1">
                                                <Wand2 className="h-4 w-4 text-purple-500" />
                                                {textSuggestionCount} text fixes
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                                                {targetSuggestionCount} target fixes
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={selectAll}>
                                                Select All
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={selectNone}>
                                                Select None
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[300px]">Question</TableHead>
                                                    <TableHead>
                                                        <div className="flex items-center gap-2">
                                                            <Wand2 className="h-4 w-4 text-purple-500" />
                                                            Text Fix
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => selectedTextIds.size === textSuggestionCount ? selectNoneText() : selectAllText()}
                                                            >
                                                                {selectedTextIds.size === textSuggestionCount ? 'None' : 'All'}
                                                            </Button>
                                                        </div>
                                                    </TableHead>
                                                    <TableHead>
                                                        <div className="flex items-center gap-2">
                                                            <ShieldCheck className="h-4 w-4 text-indigo-500" />
                                                            Target Fix
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => selectedTargetIds.size === targetSuggestionCount ? selectNoneTargets() : selectAllTargets()}
                                                            >
                                                                {selectedTargetIds.size === targetSuggestionCount ? 'None' : 'All'}
                                                            </Button>
                                                        </div>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {suggestions.map((suggestion) => (
                                                    <TableRow key={suggestion.questionId}>
                                                        {/* Question Column */}
                                                        <TableCell className="align-top">
                                                            <div className="text-sm font-medium line-clamp-2">{suggestion.question.text}</div>
                                                            {suggestion.question.partner_text && (
                                                                <div className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                                                                    Partner: {suggestion.question.partner_text}
                                                                </div>
                                                            )}
                                                        </TableCell>

                                                        {/* Text Fix Column */}
                                                        <TableCell className="align-top">
                                                            {suggestion.textSuggestion ? (
                                                                <div
                                                                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${selectedTextIds.has(suggestion.questionId)
                                                                            ? 'bg-purple-500/20 border-purple-500/50'
                                                                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                                                        }`}
                                                                    onClick={() => toggleTextSelection(suggestion.questionId)}
                                                                >
                                                                    <div className="flex items-start gap-2">
                                                                        <Checkbox
                                                                            checked={selectedTextIds.has(suggestion.questionId)}
                                                                            onCheckedChange={() => toggleTextSelection(suggestion.questionId)}
                                                                            className="mt-0.5"
                                                                        />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-sm text-purple-300 font-medium">
                                                                                {suggestion.textSuggestion.suggested_text}
                                                                            </div>
                                                                            {suggestion.textSuggestion.suggested_partner_text && (
                                                                                <div className="text-xs text-purple-400 mt-1 italic">
                                                                                    Partner: {suggestion.textSuggestion.suggested_partner_text}
                                                                                </div>
                                                                            )}
                                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                                {suggestion.textSuggestion.reason}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-muted-foreground p-2">
                                                                    <Check className="h-4 w-4 text-green-500 inline mr-1" />
                                                                    No changes needed
                                                                </div>
                                                            )}
                                                        </TableCell>

                                                        {/* Target Fix Column */}
                                                        <TableCell className="align-top">
                                                            {suggestion.targetSuggestion ? (
                                                                <div
                                                                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${selectedTargetIds.has(suggestion.questionId)
                                                                            ? 'bg-indigo-500/20 border-indigo-500/50'
                                                                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                                                        }`}
                                                                    onClick={() => toggleTargetSelection(suggestion.questionId)}
                                                                >
                                                                    <div className="flex items-start gap-2">
                                                                        <Checkbox
                                                                            checked={selectedTargetIds.has(suggestion.questionId)}
                                                                            onCheckedChange={() => toggleTargetSelection(suggestion.questionId)}
                                                                            className="mt-0.5"
                                                                        />
                                                                        <div className="flex-1 min-w-0 space-y-2">
                                                                            {/* Couple targets */}
                                                                            <div className="flex items-center gap-1 flex-wrap">
                                                                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                                                    {formatTargets(suggestion.question.allowed_couple_genders)}
                                                                                </Badge>
                                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                                <Badge className="text-[10px] bg-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30">
                                                                                    {formatTargets(suggestion.targetSuggestion.suggested_targets)}
                                                                                </Badge>
                                                                            </div>
                                                                            {/* Initiator */}
                                                                            <div className="flex items-center gap-1 flex-wrap">
                                                                                <Badge variant="outline" className="text-[10px] text-muted-foreground border-orange-500/50">
                                                                                    {formatInitiator(suggestion.question.target_user_genders)}
                                                                                </Badge>
                                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                                <Badge className="text-[10px] bg-orange-500/30 text-orange-300 hover:bg-orange-500/30">
                                                                                    {formatInitiator(suggestion.targetSuggestion.suggested_initiator)}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {suggestion.targetSuggestion.reason}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-muted-foreground p-2">
                                                                    <Check className="h-4 w-4 text-green-500 inline mr-1" />
                                                                    No changes needed
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
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
                                disabled={applying || suggestions.length === 0 || totalSelectedCount === 0}
                                className="bg-amber-600 hover:bg-amber-700"
                            >
                                {applying ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Applying...
                                    </>
                                ) : (
                                    `Apply ${totalSelectedCount} Changes`
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
