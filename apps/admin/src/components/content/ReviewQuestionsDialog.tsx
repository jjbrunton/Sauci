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
import { Loader2, Sparkles, ArrowRight, Check, Wand2, ShieldCheck, Trash2, Package } from 'lucide-react';
import {
    analyzeQuestionText,
    analyzeQuestionTargets,
    analyzeQuestionDeletions,
    analyzeQuestionProps,
    TextAnalysis,
    TargetAnalysis,
    DeletionAnalysis,
    PropsAnalysis,
} from '@/lib/openai';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { toast } from 'sonner';

type QuestionType = 'swipe' | 'text_answer' | 'audio' | 'photo' | 'who_likely';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    swipe: 'Swipe',
    text_answer: 'Text Answer',
    audio: 'Audio',
    photo: 'Photo',
    who_likely: 'Who Is More Likely',
};

interface Question {
    id: string;
    text: string;
    partner_text: string | null;
    intensity: number;
    allowed_couple_genders: string[] | null;
    target_user_genders: string[] | null;
    required_props?: string[] | null;
    question_type?: QuestionType | null;
}

interface ReviewQuestionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questions: Question[];
    onUpdated: () => void;
}

interface CombinedSuggestion {
    questionId: string;
    question: Question;
    textSuggestion?: TextAnalysis;
    targetSuggestion?: TargetAnalysis;
    propsSuggestion?: PropsAnalysis;
    deleteSuggestion?: DeletionAnalysis;
}

export function ReviewQuestionsDialog({ open, onOpenChange, questions, onUpdated }: ReviewQuestionsDialogProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<CombinedSuggestion[]>([]);
    const [existingProps, setExistingProps] = useState<string[]>([]);
    const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
    const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
    const [selectedPropsIds, setSelectedPropsIds] = useState<Set<string>>(new Set());
    const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
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

    const loadExistingProps = async (): Promise<string[]> => {
        if (existingProps.length > 0) return existingProps;

        try {
            const { data, error } = await supabase
                .from('questions')
                .select('required_props')
                .not('required_props', 'is', null)
                .limit(5000);

            if (error) throw error;

            const next = new Set<string>();
            data?.forEach(row => {
                row.required_props?.forEach((prop: string) => next.add(prop));
            });

            const list = Array.from(next).sort((a, b) => a.localeCompare(b));
            setExistingProps(list);
            return list;
        } catch (error) {
            console.error('Failed to load existing props:', error);
            return [];
        }
    };

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            const propsCatalog = await loadExistingProps();

            // Run analyses in parallel (pass intensity for text analysis)
            const [textResults, targetResults, deleteResults, propsResults] = await Promise.all([
                analyzeQuestionText(
                    questions.map(q => ({ ...q, intensity: q.intensity })),
                    false
                ),
                analyzeQuestionTargets(questions),
                analyzeQuestionDeletions(questions, false),
                analyzeQuestionProps(
                    questions.map(q => ({
                        id: q.id,
                        text: q.text,
                        partner_text: q.partner_text,
                        required_props: q.required_props || null,
                    })),
                    propsCatalog
                ),
            ]) as [TextAnalysis[], TargetAnalysis[], DeletionAnalysis[], PropsAnalysis[]];

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

            const meaningfulPropsResults = propsResults.filter(suggestion => {
                const question = questions.find(q => q.id === suggestion.id);
                if (!question) return false;

                return !arraysEqual(
                    question.required_props || null,
                    suggestion.suggested_required_props || null
                );
            });

            const combined: CombinedSuggestion[] = questions.map(question => ({
                questionId: question.id,
                question,
                textSuggestion: textResults.find(t => t.id === question.id),
                targetSuggestion: meaningfulTargetResults.find(t => t.id === question.id),
                propsSuggestion: meaningfulPropsResults.find(p => p.id === question.id),
                deleteSuggestion: deleteResults.find(d => d.id === question.id),
            }));

            setSuggestions(combined);
            // Default select all
            setSelectedTextIds(new Set(textResults.map(r => r.id)));
            setSelectedTargetIds(new Set(meaningfulTargetResults.map(r => r.id)));
            setSelectedPropsIds(new Set(meaningfulPropsResults.map(r => r.id)));
            setSelectedDeleteIds(new Set(deleteResults.map(r => r.id)));
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
            const deleteIds = Array.from(selectedDeleteIds);

            // Build update objects combining text, target, and props changes
            suggestions.forEach(suggestion => {
                if (selectedDeleteIds.has(suggestion.questionId)) return;

                const textSelected = selectedTextIds.has(suggestion.questionId) && suggestion.textSuggestion;
                const targetSelected = selectedTargetIds.has(suggestion.questionId) && suggestion.targetSuggestion;
                const propsSelected = selectedPropsIds.has(suggestion.questionId) && suggestion.propsSuggestion;

                if (textSelected || targetSelected || propsSelected) {
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

                    if (propsSelected && suggestion.propsSuggestion) {
                        updateData.required_props = suggestion.propsSuggestion.suggested_required_props &&
                            suggestion.propsSuggestion.suggested_required_props.length > 0
                            ? suggestion.propsSuggestion.suggested_required_props
                            : null;
                    }

                    if (Object.keys(updateData).length > 0) {
                        updates.push({ id: suggestion.questionId, data: updateData });
                    }
                }
            });

            if (updates.length === 0 && deleteIds.length === 0) {
                onOpenChange(false);
                return;
            }

            // Apply updates/deletions in parallel with audit logging
            const operations: Promise<unknown>[] = updates.map(update =>
                auditedSupabase.update('questions', update.id, update.data)
            );

            if (deleteIds.length > 0) {
                operations.push(
                    auditedSupabase.deleteMany('questions', deleteIds).then(result => {
                        if (result.error) throw result.error;
                    })
                );
            }

            await Promise.all(operations);

            const updateMessage = updates.length > 0 ? `Updated ${updates.length} questions` : null;
            const deleteMessage = deleteIds.length > 0 ? `Deleted ${deleteIds.length} questions` : null;
            const message = [updateMessage, deleteMessage].filter(Boolean).join('. ');
            if (message) {
                toast.success(message);
            }
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
            setSelectedPropsIds(new Set());
            setSelectedDeleteIds(new Set());
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

    const togglePropsSelection = (id: string) => {
        const next = new Set(selectedPropsIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPropsIds(next);
    };

    const toggleDeleteSelection = (id: string) => {
        const next = new Set(selectedDeleteIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedDeleteIds(next);
    };

    const formatTargets = (targets: string[] | null) => {
        if (!targets || targets.length === 0) return 'All';
        return targets.map(t => t.replace('male+male', 'M+M').replace('female+male', 'M+F').replace('female+female', 'F+F')).join(', ');
    };

    const formatInitiator = (targets: string[] | null) => {
        if (!targets || targets.length === 0) return 'Any';
        return targets.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
    };

    const formatProps = (props: string[] | null | undefined) => {
        if (!props || props.length === 0) return 'None';
        return props.join(', ');
    };

    const formatDeleteCategory = (category?: DeletionAnalysis['category']) => {
        switch (category) {
            case 'duplicate':
                return 'Duplicate';
            case 'redundant':
                return 'Redundant';
            case 'off-tone':
                return 'Off tone';
            case 'unsafe':
                return 'Unsafe';
            case 'too-vague':
                return 'Too vague';
            case 'broken':
                return 'Broken';
            case 'off-topic':
                return 'Off topic';
            default:
                return 'Delete';
        }
    };

    const getQuestionTextById = (id?: string | null) => {
        if (!id) return null;
        const match = questions.find(q => q.id === id);
        return match ? match.text : null;
    };

    // Count suggestions by type
    const textSuggestionCount = suggestions.filter(s => s.textSuggestion).length;
    const targetSuggestionCount = suggestions.filter(s => s.targetSuggestion).length;
    const propsSuggestionCount = suggestions.filter(s => s.propsSuggestion).length;
    const deleteSuggestionCount = suggestions.filter(s => s.deleteSuggestion).length;
    const effectiveTextCount = Array.from(selectedTextIds).filter(id => !selectedDeleteIds.has(id)).length;
    const effectiveTargetCount = Array.from(selectedTargetIds).filter(id => !selectedDeleteIds.has(id)).length;
    const effectivePropsCount = Array.from(selectedPropsIds).filter(id => !selectedDeleteIds.has(id)).length;
    const totalSelectedCount = effectiveTextCount + effectiveTargetCount + effectivePropsCount + selectedDeleteIds.size;
    const hasSuggestions = textSuggestionCount > 0 || targetSuggestionCount > 0 || propsSuggestionCount > 0 || deleteSuggestionCount > 0;

    // Select all/none helpers
    const selectAllText = () => setSelectedTextIds(new Set(suggestions.filter(s => s.textSuggestion).map(s => s.questionId)));
    const selectNoneText = () => setSelectedTextIds(new Set());
    const selectAllTargets = () => setSelectedTargetIds(new Set(suggestions.filter(s => s.targetSuggestion).map(s => s.questionId)));
    const selectNoneTargets = () => setSelectedTargetIds(new Set());
    const selectAllProps = () => setSelectedPropsIds(new Set(suggestions.filter(s => s.propsSuggestion).map(s => s.questionId)));
    const selectNoneProps = () => setSelectedPropsIds(new Set());
    const selectAllDeletes = () => setSelectedDeleteIds(new Set(suggestions.filter(s => s.deleteSuggestion).map(s => s.questionId)));
    const selectNoneDeletes = () => setSelectedDeleteIds(new Set());
    const selectAll = () => {
        selectAllText();
        selectAllTargets();
        selectAllProps();
        selectAllDeletes();
    };
    const selectNone = () => {
        selectNoneText();
        selectNoneTargets();
        selectNoneProps();
        selectNoneDeletes();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Review Questions
                    </DialogTitle>
                    <DialogDescription>
                        AI-powered analysis to improve phrasing, identify props, fix targeting, and suggest deletions.
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
                                    The AI will analyze all questions and suggest improvements or removals for:
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
                                <div className="flex items-center gap-2 bg-cyan-500/20 px-4 py-2 rounded-lg">
                                    <Package className="h-5 w-5 text-cyan-400" />
                                    <span className="text-sm font-medium text-cyan-300">Required Props</span>
                                </div>
                                <div className="flex items-center gap-2 bg-rose-500/20 px-4 py-2 rounded-lg">
                                    <Trash2 className="h-5 w-5 text-rose-400" />
                                    <span className="text-sm font-medium text-rose-300">Deletion Suggestions</span>
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
                            {!hasSuggestions ? (
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
                                            <span className="flex items-center gap-1">
                                                <Package className="h-4 w-4 text-cyan-500" />
                                                {propsSuggestionCount} props fixes
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Trash2 className="h-4 w-4 text-rose-500" />
                                                {deleteSuggestionCount} delete suggestions
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

                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[18%] min-w-[180px]">Question</TableHead>
                                                    <TableHead className="w-[26%]">
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
                                                    <TableHead className="w-[18%]">
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
                                                    <TableHead className="w-[18%]">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="h-4 w-4 text-cyan-500" />
                                                            Props
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => selectedPropsIds.size === propsSuggestionCount ? selectNoneProps() : selectAllProps()}
                                                            >
                                                                {selectedPropsIds.size === propsSuggestionCount ? 'None' : 'All'}
                                                            </Button>
                                                        </div>
                                                    </TableHead>
                                                    <TableHead className="w-[10%]">
                                                        <div className="flex items-center gap-2">
                                                            <Trash2 className="h-4 w-4 text-rose-500" />
                                                            Delete
                                                            {deleteSuggestionCount > 0 && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-2 text-xs"
                                                                    onClick={() => selectedDeleteIds.size === deleteSuggestionCount ? selectNoneDeletes() : selectAllDeletes()}
                                                                >
                                                                    {selectedDeleteIds.size === deleteSuggestionCount ? 'None' : 'All'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {suggestions.map((suggestion) => (
                                                    <TableRow key={suggestion.questionId}>
                                                        {/* Question Column */}
                                                        <TableCell className="align-top py-3">
                                                            <div className="text-sm font-medium">{suggestion.question.text}</div>
                                                            <div className="mt-1">
                                                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                                                    {QUESTION_TYPE_LABELS[suggestion.question.question_type ?? 'swipe']}
                                                                </Badge>
                                                            </div>
                                                            {suggestion.question.partner_text && (
                                                                <div className="text-xs text-muted-foreground mt-1.5 italic">
                                                                    Partner: {suggestion.question.partner_text}
                                                                </div>
                                                            )}
                                                        </TableCell>

                                                        {/* Text Fix Column */}
                                                        <TableCell className="align-top py-3">
                                                            {suggestion.textSuggestion ? (
                                                                <div
                                                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTextIds.has(suggestion.questionId)
                                                                            ? 'bg-purple-500/20 border-purple-500/50'
                                                                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                                                        }`}
                                                                    onClick={() => toggleTextSelection(suggestion.questionId)}
                                                                >
                                                                    <div className="flex items-start gap-3">
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
                                                                                <div className="text-xs text-purple-400 mt-1.5 italic">
                                                                                    Partner: {suggestion.textSuggestion.suggested_partner_text}
                                                                                </div>
                                                                            )}
                                                                            <div className="text-xs text-muted-foreground mt-2">
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
                                                        <TableCell className="align-top py-3">
                                                            {suggestion.targetSuggestion ? (
                                                                <div
                                                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTargetIds.has(suggestion.questionId)
                                                                            ? 'bg-indigo-500/20 border-indigo-500/50'
                                                                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                                                        }`}
                                                                    onClick={() => toggleTargetSelection(suggestion.questionId)}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <Checkbox
                                                                            checked={selectedTargetIds.has(suggestion.questionId)}
                                                                            onCheckedChange={() => toggleTargetSelection(suggestion.questionId)}
                                                                            className="mt-0.5"
                                                                        />
                                                                        <div className="flex-1 min-w-0 space-y-2">
                                                                            {/* Couple targets */}
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="text-xs text-muted-foreground">Couples:</span>
                                                                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                                                                    {formatTargets(suggestion.question.allowed_couple_genders)}
                                                                                </Badge>
                                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                                <Badge className="text-xs bg-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30">
                                                                                    {formatTargets(suggestion.targetSuggestion.suggested_targets)}
                                                                                </Badge>
                                                                            </div>
                                                                            {/* Initiator */}
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="text-xs text-muted-foreground">Initiator:</span>
                                                                                <Badge variant="outline" className="text-xs text-muted-foreground border-orange-500/50">
                                                                                    {formatInitiator(suggestion.question.target_user_genders)}
                                                                                </Badge>
                                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                                <Badge className="text-xs bg-orange-500/30 text-orange-300 hover:bg-orange-500/30">
                                                                                    {formatInitiator(suggestion.targetSuggestion.suggested_initiator)}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground mt-2">
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

                                                        {/* Props Column */}
                                                        <TableCell className="align-top py-3">
                                                            {suggestion.propsSuggestion ? (
                                                                <div
                                                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedPropsIds.has(suggestion.questionId)
                                                                            ? 'bg-cyan-500/20 border-cyan-500/50'
                                                                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                                                        }`}
                                                                    onClick={() => togglePropsSelection(suggestion.questionId)}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <Checkbox
                                                                            checked={selectedPropsIds.has(suggestion.questionId)}
                                                                            onCheckedChange={() => togglePropsSelection(suggestion.questionId)}
                                                                            className="mt-0.5"
                                                                        />
                                                                        <div className="flex-1 min-w-0 space-y-2">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="text-xs text-muted-foreground">Current:</span>
                                                                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                                                                    {formatProps(suggestion.question.required_props)}
                                                                                </Badge>
                                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                                <Badge className="text-xs bg-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30">
                                                                                    {formatProps(suggestion.propsSuggestion.suggested_required_props)}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground mt-2">
                                                                                {suggestion.propsSuggestion.reason}
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

                                                        {/* Delete Column */}
                                                        <TableCell className="align-top py-3">
                                                            {suggestion.deleteSuggestion ? (
                                                                <div
                                                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedDeleteIds.has(suggestion.questionId)
                                                                            ? 'bg-rose-500/20 border-rose-500/50'
                                                                            : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                                                        }`}
                                                                    onClick={() => toggleDeleteSelection(suggestion.questionId)}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <Checkbox
                                                                            checked={selectedDeleteIds.has(suggestion.questionId)}
                                                                            onCheckedChange={() => toggleDeleteSelection(suggestion.questionId)}
                                                                            className="mt-0.5"
                                                                        />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-sm text-rose-300 font-medium">
                                                                                {formatDeleteCategory(suggestion.deleteSuggestion.category)} recommended
                                                                            </div>
                                                                            {suggestion.deleteSuggestion.duplicate_of_id && (
                                                                                <div className="text-xs text-rose-400 mt-1">
                                                                                    Duplicate of: {getQuestionTextById(suggestion.deleteSuggestion.duplicate_of_id) || 'Another question'}
                                                                                </div>
                                                                            )}
                                                                            <div className="text-xs text-muted-foreground mt-2">
                                                                                {suggestion.deleteSuggestion.reason}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-muted-foreground p-2">
                                                                    <Check className="h-4 w-4 text-green-500 inline mr-1" />
                                                                    Keep
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
                                    `Apply ${totalSelectedCount} Actions`
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
