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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import { analyzeQuestionTargets, TargetAnalysis } from '@/lib/openai';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { toast } from 'sonner';

// Define local compatible interface
interface Question {
    id: string;
    text: string;
    partner_text: string | null;
    intensity: number;
    allowed_couple_genders: string[] | null;
    target_user_genders: string[] | null;
}

interface FixTargetsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questions: Question[];
    onUpdated: () => void;
}

export function FixTargetsDialog({ open, onOpenChange, questions, onUpdated }: FixTargetsDialogProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<TargetAnalysis[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [step, setStep] = useState<'initial' | 'review'>('initial');
    const [applying, setApplying] = useState(false);

    // Check if couple targets represent "All" (null, empty, or all three values)
    const isAllCoupleTargets = (targets: string[] | null): boolean => {
        if (!targets || targets.length === 0) return true;
        if (targets.length === 3) {
            const sorted = [...targets].sort();
            return sorted[0] === 'female+female' && sorted[1] === 'female+male' && sorted[2] === 'male+male';
        }
        return false;
    };

    // Check if initiator targets represent "All" (null or empty)
    const isAllInitiator = (targets: string[] | null): boolean => {
        return !targets || targets.length === 0;
    };

    // Check if two arrays are equal
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
            const results = await analyzeQuestionTargets(questions);
            // Filter out redundant suggestions where nothing meaningful changes
            const meaningfulResults = results.filter(suggestion => {
                const question = questions.find(q => q.id === suggestion.id);
                if (!question) return false;

                // Check if couple targets change meaningfully
                const currentCoupleIsAll = isAllCoupleTargets(question.allowed_couple_genders);
                const suggestedCoupleIsAll = isAllCoupleTargets(suggestion.suggested_targets);
                const coupleChanged = !(currentCoupleIsAll && suggestedCoupleIsAll) &&
                    !arraysEqual(question.allowed_couple_genders, suggestion.suggested_targets);

                // Check if initiator changes meaningfully
                const currentInitiatorIsAll = isAllInitiator(question.target_user_genders);
                const suggestedInitiatorIsAll = isAllInitiator(suggestion.suggested_initiator);
                const initiatorChanged = !(currentInitiatorIsAll && suggestedInitiatorIsAll) &&
                    !arraysEqual(question.target_user_genders, suggestion.suggested_initiator);

                // Include if either changed
                return coupleChanged || initiatorChanged;
            });
            setSuggestions(meaningfulResults);
            // Default select all
            setSelectedIds(new Set(meaningfulResults.map(r => r.id)));
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
                    allowed_couple_genders: update.suggested_targets && update.suggested_targets.length > 0 ? update.suggested_targets : null,
                    target_user_genders: update.suggested_initiator && update.suggested_initiator.length > 0 ? update.suggested_initiator : null,
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

    const formatTargets = (targets: string[] | null) => {
        if (!targets || targets.length === 0) return 'All';
        return targets.map(t => t.replace('male+male', 'M+M').replace('female+male', 'M+F').replace('female+female', 'F+F')).join(', ');
    };

    const formatInitiator = (targets: string[] | null) => {
        if (!targets || targets.length === 0) return 'Any';
        return targets.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-500" />
                        Fix Question Targets
                    </DialogTitle>
                    <DialogDescription>
                        Use AI to detect anatomical or configuration constraints in your questions.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {step === 'initial' ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="bg-indigo-500/20 p-4 rounded-full">
                                <ShieldCheck className="h-12 w-12 text-indigo-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">Ready to analyze {questions.length} questions</h3>
                                <p className="text-muted-foreground max-w-md mx-auto">
                                    The AI will look for anatomical requirements (e.g., acts requiring specific genitalia) and suggest target restrictions.
                                </p>
                            </div>
                            <Button onClick={handleAnalyze} disabled={analyzing} size="lg">
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
                                    No issues found! All questions seem to have appropriate targets.
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
                                                <TableHead>Question</TableHead>
                                                <TableHead>Couples</TableHead>
                                                <TableHead>Initiator</TableHead>
                                                <TableHead>Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {suggestions.map((suggestion) => {
                                                const question = questions.find(q => q.id === suggestion.id);
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
                                                            <div className="line-clamp-2 text-sm font-medium">{question.text}</div>
                                                            {question.partner_text && (
                                                                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                                    Partner: {question.partner_text}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <div className="flex items-center gap-1">
                                                                <Badge variant="outline" className="text-muted-foreground">
                                                                    {formatTargets(question.allowed_couple_genders)}
                                                                </Badge>
                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                <Badge variant="secondary" className="bg-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30">
                                                                    {formatTargets(suggestion.suggested_targets)}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <div className="flex items-center gap-1">
                                                                <Badge variant="outline" className="text-muted-foreground border-orange-500/50">
                                                                    {formatInitiator(question.target_user_genders)}
                                                                </Badge>
                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                <Badge variant="secondary" className="bg-orange-500/30 text-orange-300 hover:bg-orange-500/30">
                                                                    {formatInitiator(suggestion.suggested_initiator)}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
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
                            <Button onClick={handleApply} disabled={applying || suggestions.length === 0 || selectedIds.size === 0}>
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
