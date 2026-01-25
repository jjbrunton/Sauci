import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Sparkles, Loader2, Users, Link2, Eye } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { AiGeneratorDialog } from '@/components/ai/AiGeneratorDialog';
import { AIPolishButton } from '@/components/ai/AIPolishButton';
import { ReviewQuestionsDialog } from '@/components/content/ReviewQuestionsDialog';
import { IconPreview } from '@/components/ui/icon-picker';

interface QuestionPack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_explicit: boolean;
}

type QuestionType = 'swipe' | 'text_answer' | 'audio' | 'photo' | 'who_likely';

interface QuestionConfig {
    max_duration_seconds?: number;
}

interface Question {
    id: string;
    pack_id: string;
    text: string;
    partner_text: string | null;
    intensity: number;
    allowed_couple_genders: string[] | null;
    target_user_genders: string[] | null;
    required_props?: string[] | null;
    inverse_of?: string | null;
    created_at: string | null;
    question_type?: QuestionType | null;
    config?: QuestionConfig | null;
}

const DEFAULT_AUDIO_DURATION = 60;
const getDefaultIntensity = (isExplicit?: boolean) => (isExplicit ? 4 : 2);

const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
    { value: 'swipe', label: 'Swipe' },
    { value: 'text_answer', label: 'Text Answer' },
    { value: 'audio', label: 'Audio' },
    { value: 'photo', label: 'Photo' },
    { value: 'who_likely', label: 'Who Is More Likely' },
];

const getQuestionTypeLabel = (type?: QuestionType | null) => {
    const resolved = type ?? 'swipe';
    return QUESTION_TYPE_OPTIONS.find(option => option.value === resolved)?.label ?? 'Swipe';
};

const getConfigSummary = (question: Question) => {
    if (question.question_type === 'audio') {
        const duration = question.config?.max_duration_seconds ?? DEFAULT_AUDIO_DURATION;
        return `${duration}s max`;
    }

    return null;
};

export function QuestionsPage() {
    const { packId } = useParams<{ packId: string }>();
    const [pack, setPack] = useState<QuestionPack | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [peekOpen, setPeekOpen] = useState(false);
    const [peekPrimary, setPeekPrimary] = useState<Question | null>(null);
    const [peekInverse, setPeekInverse] = useState<Question | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalCount, setTotalCount] = useState(0);
    const [questionTypeFilter, setQuestionTypeFilter] = useState<QuestionType | 'all'>('all');

    // Form state
    const [formData, setFormData] = useState<{
        text: string;
        partner_text: string;
        intensity: number;
        allowed_couple_genders: string[];
        target_user_genders: string[];
        required_props: string;
        inverse_of: string;
        question_type: QuestionType;
        max_duration_seconds: string;
    }>({
        text: '',
        partner_text: '',
        intensity: getDefaultIntensity(),
        allowed_couple_genders: [],
        target_user_genders: [],
        required_props: '',
        inverse_of: '',
        question_type: 'swipe',
        max_duration_seconds: String(DEFAULT_AUDIO_DURATION),
    });

    // All questions in pack for inverse_of dropdown (loaded once)
    const [allPackQuestions, setAllPackQuestions] = useState<Question[]>([]);

    const fetchData = useCallback(async () => {
        if (!packId) return;

        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const packPromise = supabase
                .from('question_packs')
                .select('id, name, description, icon, is_explicit')
                .eq('id', packId)
                .single();
            let questionsQuery = supabase
                .from('questions')
                .select('*', { count: 'exact' })
                .eq('pack_id', packId)
                .order('created_at', { ascending: true })
                .range(from, to);

            if (questionTypeFilter !== 'all') {
                questionsQuery = questionsQuery.eq('question_type', questionTypeFilter);
            }

            const questionsPromise = questionsQuery;
            const allPackPromise = supabase
                .from('questions')
                .select('id, text, inverse_of')
                .eq('pack_id', packId)
                .is('deleted_at', null)
                .order('created_at', { ascending: true });

            const [
                { data: packData, error: packError },
                { data: questionData, error, count },
                { data: allPackData, error: allPackError },
            ] = await Promise.all([packPromise, questionsPromise, allPackPromise]);

            if (packError) throw packError;
            if (error) throw error;
            setTotalCount(count || 0);
            setQuestions(questionData || []);
            setPack(packData);
            if (allPackError) {
                toast.error('Failed to load inverse peek data');
                console.error(allPackError);
            } else {
                setAllPackQuestions((allPackData as Question[]) || []);
            }
        } catch (error) {
            toast.error('Failed to load questions');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [packId, page, pageSize, questionTypeFilter]);

    // Real-time subscription for questions in this pack
    const { status: realtimeStatus } = useRealtimeSubscription<Question>({
        table: 'questions',
        filter: packId ? `pack_id=eq.${packId}` : undefined,
        enabled: !!packId,
        onInsert: useCallback(() => {
            fetchData();
        }, [fetchData]),
        onUpdate: useCallback(() => {
            fetchData();
        }, [fetchData]),
        onDelete: useCallback((deleted: Question) => {
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(deleted.id);
                return next;
            });
            fetchData();
        }, [fetchData]),
    });

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, pageSize, totalCount]);

    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
        setReviewQuestions([]);
        setReviewOpen(false);
    }, [packId]);

    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
    }, [questionTypeFilter]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [page, pageSize]);

    // Fetch all questions in pack for inverse_of dropdown
    const fetchAllPackQuestions = useCallback(async () => {
        if (!packId) return;
        const { data } = await supabase
            .from('questions')
            .select('id, text, inverse_of')
            .eq('pack_id', packId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
        setAllPackQuestions((data as Question[]) || []);
    }, [packId]);

    const primaryQuestionById = useMemo(() => {
        return new Map(allPackQuestions.map(question => [question.id, question]));
    }, [allPackQuestions]);

    const openCreateDialog = async () => {
        setEditingQuestion(null);
        setFormData({
            text: '',
            partner_text: '',
            intensity: getDefaultIntensity(pack?.is_explicit),
            allowed_couple_genders: [],
            target_user_genders: [],
            required_props: '',
            inverse_of: '',
            question_type: 'swipe',
            max_duration_seconds: String(DEFAULT_AUDIO_DURATION),
        });
        await fetchAllPackQuestions();
        setDialogOpen(true);
    };

    const openEditDialog = async (question: Question) => {
        setEditingQuestion(question);
        setFormData({
            text: question.text,
            partner_text: question.partner_text || '',
            intensity: question.intensity,
            allowed_couple_genders: question.allowed_couple_genders || [],
            target_user_genders: question.target_user_genders || [],
            required_props: question.required_props?.join(', ') ?? '',
            inverse_of: question.inverse_of || '',
            question_type: question.question_type ?? 'swipe',
            max_duration_seconds: String(question.config?.max_duration_seconds ?? DEFAULT_AUDIO_DURATION),
        });
        await fetchAllPackQuestions();
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.text.trim()) {
            toast.error('Question text is required');
            return;
        }

        const requiredProps = formData.required_props
            .split(/[,;\n]/)
            .map(value => value.trim())
            .filter(Boolean);
        const requiredPropsValue = requiredProps.length > 0 ? requiredProps : null;
        const parsedMaxDuration = Number(formData.max_duration_seconds);
        const maxDuration = Number.isFinite(parsedMaxDuration) && parsedMaxDuration > 0
            ? parsedMaxDuration
            : DEFAULT_AUDIO_DURATION;
        const configValue = formData.question_type === 'audio'
            ? { max_duration_seconds: maxDuration }
            : null;

        setSaving(true);
        try {
            if (editingQuestion) {
                const { error } = await auditedSupabase.update('questions', editingQuestion.id, {
                    text: formData.text,
                    partner_text: formData.partner_text || null,
                    intensity: formData.intensity,
                    allowed_couple_genders: formData.allowed_couple_genders.length > 0 ? formData.allowed_couple_genders : null,
                    target_user_genders: formData.target_user_genders.length > 0 ? formData.target_user_genders : null,
                    required_props: requiredPropsValue,
                    inverse_of: formData.inverse_of || null,
                    question_type: formData.question_type,
                    config: configValue,
                });

                if (error) throw error;
                toast.success('Question updated');
            } else {
                const { error } = await auditedSupabase.insert('questions', {
                    pack_id: packId,
                    text: formData.text,
                    partner_text: formData.partner_text || null,
                    intensity: formData.intensity,
                    allowed_couple_genders: formData.allowed_couple_genders.length > 0 ? formData.allowed_couple_genders : null,
                    target_user_genders: formData.target_user_genders.length > 0 ? formData.target_user_genders : null,
                    required_props: requiredPropsValue,
                    inverse_of: formData.inverse_of || null,
                    question_type: formData.question_type,
                    config: configValue,
                });

                if (error) throw error;
                toast.success('Question created');
            }

            setDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to save question');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (question: Question) => {
        if (!confirm('Delete this question? This cannot be undone.')) {
            return;
        }

        try {
            const { error } = await auditedSupabase.delete('questions', question.id);

            if (error) throw error;
            toast.success('Question deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete question');
            console.error(error);
        }
    };

    const handleAiGenerated = (generatedQuestions: Array<{ text: string; partner_text?: string; intensity: number; inverse_pair_id?: string | null }>) => {
        const generatedQuestionType: QuestionType = 'swipe';
        const defaultIntensity = getDefaultIntensity(pack?.is_explicit);

        // Bulk insert AI-generated questions with inverse_of linking
        const insertQuestions = async () => {
            try {
                // Group questions by inverse_pair_id
                const pairMap = new Map<string, typeof generatedQuestions>();
                const standaloneQuestions: typeof generatedQuestions = [];

                for (const q of generatedQuestions) {
                    if (q.inverse_pair_id) {
                        const existing = pairMap.get(q.inverse_pair_id) || [];
                        existing.push(q);
                        pairMap.set(q.inverse_pair_id, existing);
                    } else {
                        standaloneQuestions.push(q);
                    }
                }

                // Insert standalone questions first (no inverse_of)
                if (standaloneQuestions.length > 0) {
                    const { error: standaloneError } = await auditedSupabase.insert(
                        'questions',
                        standaloneQuestions.map(q => ({
                            pack_id: packId,
                            text: q.text,
                            partner_text: q.partner_text || null,
                            intensity: defaultIntensity,
                            inverse_of: null,
                            question_type: generatedQuestionType,
                            config: null,
                        }))
                    );
                    if (standaloneError) throw standaloneError;
                }

                // Insert paired questions: primary first, then inverse with inverse_of link
                for (const [, pair] of pairMap) {
                    if (pair.length >= 2) {
                        // First question is primary (inverse_of = NULL)
                        const primary = pair[0];
                        const { data: primaryData, error: primaryError } = await auditedSupabase.insert(
                            'questions',
                            [{
                                pack_id: packId,
                                text: primary.text,
                                partner_text: primary.partner_text || null,
                                intensity: defaultIntensity,
                                inverse_of: null,
                                question_type: generatedQuestionType,
                                config: null,
                            }]
                        );
                        if (primaryError) throw primaryError;

                        // Second question is inverse (inverse_of = primary's id)
                        const primaryId = primaryData?.[0]?.id;
                        if (primaryId) {
                            const inverse = pair[1];
                            const { error: inverseError } = await auditedSupabase.insert(
                                'questions',
                                [{
                                    pack_id: packId,
                                    text: inverse.text,
                                    partner_text: inverse.partner_text || null,
                                    intensity: defaultIntensity,
                                    inverse_of: primaryId,
                                    question_type: generatedQuestionType,
                                    config: null,
                                }]
                            );
                            if (inverseError) throw inverseError;
                        }

                        // Handle any additional questions in the pair (shouldn't happen, but just in case)
                        for (let i = 2; i < pair.length; i++) {
                            const extra = pair[i];
                            const { error: extraError } = await auditedSupabase.insert(
                                'questions',
                                [{
                                    pack_id: packId,
                                    text: extra.text,
                                    partner_text: extra.partner_text || null,
                                    intensity: defaultIntensity,
                                    inverse_of: null,
                                    question_type: generatedQuestionType,
                                    config: null,
                                }]
                            );
                            if (extraError) throw extraError;
                        }
                    } else if (pair.length === 1) {
                        // Single question with pair_id but no pair - treat as standalone
                        const { error } = await auditedSupabase.insert(
                            'questions',
                            [{
                            pack_id: packId,
                            text: pair[0].text,
                            partner_text: pair[0].partner_text || null,
                            intensity: defaultIntensity,
                            inverse_of: null,
                            question_type: generatedQuestionType,
                            config: null,
                        }]

                        );
                        if (error) throw error;
                    }
                }

                toast.success(`${generatedQuestions.length} questions added`);
                fetchData();
            } catch (error) {
                toast.error('Failed to add questions');
                console.error(error);
            }
        };

        insertQuestions();
        setAiDialogOpen(false);
    };

    const handleReviewOpen = async () => {
        if (!packId) return;

        setReviewLoading(true);
        try {
            const { data, error } = await supabase
                .from('questions')
                .select('id, pack_id, text, partner_text, intensity, allowed_couple_genders, target_user_genders, required_props, question_type, created_at')
                .eq('pack_id', packId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setReviewQuestions(data || []);
            setReviewOpen(true);
        } catch (error) {
            toast.error('Failed to load questions for review');
            console.error(error);
        } finally {
            setReviewLoading(false);
        }
    };

    // Selection handlers
    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === questions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(questions.map(q => q.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        if (!confirm(`Delete ${count} question${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
            return;
        }

        setBulkDeleting(true);
        try {
            await Promise.all(
                Array.from(selectedIds).map(id => auditedSupabase.delete('questions', id))
            );
            toast.success(`${count} question${count !== 1 ? 's' : ''} deleted`);
            setSelectedIds(new Set());
            fetchData();
        } catch (error) {
            toast.error('Failed to delete questions');
            console.error(error);
        } finally {
            setBulkDeleting(false);
        }
    };

    const handlePeekPrimary = (question: Question) => {
        if (!question.inverse_of) return;
        setPeekPrimary(primaryQuestionById.get(question.inverse_of) ?? null);
        setPeekInverse(question);
        setPeekOpen(true);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            {pack && (
                                <>
                                    <IconPreview value={pack.icon} fallback="heart-outline" className="text-3xl" />
                                    {pack.name}
                                </>
                            )}
                        </h1>
                        <RealtimeStatusIndicator status={realtimeStatus} showLabel />
                    </div>
                    <p className="text-muted-foreground">
                        {totalCount} question{totalCount !== 1 ? 's' : ''} in this pack
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReviewOpen} disabled={reviewLoading}>
                        {reviewLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Review Questions
                    </Button>
                    <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        AI Generate
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Question
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingQuestion ? 'Edit Question' : 'Add Question'}
                                </DialogTitle>
                                <DialogDescription>
                                    {editingQuestion
                                        ? 'Update the question details below.'
                                        : 'Add a new question to this pack.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="text">Question Text</Label>
                                        <AIPolishButton
                                            text={formData.text}
                                            type="question"
                                            explicit={pack?.is_explicit ?? false}
                                            onPolished={(val) => setFormData(d => ({ ...d, text: val }))}
                                        />
                                    </div>
                                    <Textarea
                                        id="text"
                                        value={formData.text}
                                        onChange={(e) => setFormData(d => ({ ...d, text: e.target.value }))}
                                        placeholder="e.g., Would you try..."
                                        rows={3}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="question_type">Question Type</Label>
                                    <Select
                                        value={formData.question_type}
                                        onValueChange={(value) => setFormData(d => ({ ...d, question_type: value as QuestionType }))}
                                    >
                                        <SelectTrigger id="question_type">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {QUESTION_TYPE_OPTIONS.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Select how users will answer this question in the app.
                                    </p>
                                </div>

                                {formData.question_type === 'audio' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="max_duration_seconds">Max Duration (seconds)</Label>
                                        <Input
                                            id="max_duration_seconds"
                                            type="number"
                                            min={1}
                                            value={formData.max_duration_seconds}
                                            onChange={(e) => setFormData(d => ({ ...d, max_duration_seconds: e.target.value }))}
                                            placeholder="60"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Audio responses will be limited to this duration.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="partner_text">Partner Text (optional)</Label>
                                            <Badge variant="secondary" className="text-xs">
                                                <Users className="h-3 w-3 mr-1" />
                                                Two-Part
                                            </Badge>
                                        </div>
                                        <AIPolishButton
                                            text={formData.partner_text}
                                            type="partner_text"
                                            explicit={pack?.is_explicit ?? false}
                                            onPolished={(val) => setFormData(d => ({ ...d, partner_text: val }))}
                                        />
                                    </div>
                                    <Textarea
                                        id="partner_text"
                                        value={formData.partner_text}
                                        onChange={(e) => setFormData(d => ({ ...d, partner_text: e.target.value }))}
                                        placeholder="Alternative text shown to the partner (for role-specific questions)"
                                        rows={2}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        If set, the partner will see this text instead. Useful for "Would you..." / "Would your partner..." style questions.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="required_props">Required Props (optional)</Label>
                                    <Input
                                        id="required_props"
                                        value={formData.required_props}
                                        onChange={(e) => setFormData(d => ({ ...d, required_props: e.target.value }))}
                                        placeholder="e.g., vibrator, restraints"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Comma-separated list of props/accessories needed for this question.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="inverse_of">Inverse Of (optional)</Label>
                                        <Badge variant="outline" className="text-xs">
                                            <Link2 className="h-3 w-3 mr-1" />
                                            Paired
                                        </Badge>
                                    </div>
                                    <Select
                                        value={formData.inverse_of || 'none'}
                                        onValueChange={(value) => setFormData(d => ({ ...d, inverse_of: value === 'none' ? '' : value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select primary question..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            <SelectItem value="none">
                                                <span className="text-muted-foreground">None (this is a standalone question)</span>
                                            </SelectItem>
                                            {allPackQuestions
                                                .filter(q => q.id !== editingQuestion?.id && !q.inverse_of)
                                                .map(q => (
                                                    <SelectItem key={q.id} value={q.id}>
                                                        <span className="line-clamp-1">{q.text}</span>
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Link this question to its inverse (e.g., "give X" → "receive X"). The selected question is the primary; this one becomes its inverse.
                                        Only standalone questions can be selected as primaries.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Target Couples (optional)</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'male+male', label: 'Male + Male' },
                                            { id: 'female+male', label: 'Male + Female' },
                                            { id: 'female+female', label: 'Female + Female' },
                                        ].map((type) => {
                                            const isSelected = formData.allowed_couple_genders.includes(type.id);
                                            return (
                                                <Button
                                                    key={type.id}
                                                    type="button"
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData(d => ({
                                                            ...d,
                                                            allowed_couple_genders: isSelected
                                                                ? d.allowed_couple_genders.filter(id => id !== type.id)
                                                                : [...d.allowed_couple_genders, type.id]
                                                        }));
                                                    }}
                                                >
                                                    {type.label}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Select specific couple types to restrict this question. Leave all unselected to allow for everyone.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Initiator Gender (optional)</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'male', label: 'Male' },
                                            { id: 'female', label: 'Female' },
                                            { id: 'non-binary', label: 'Non-binary' },
                                        ].map((type) => {
                                            const isSelected = formData.target_user_genders.includes(type.id);
                                            return (
                                                <Button
                                                    key={type.id}
                                                    type="button"
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData(d => ({
                                                            ...d,
                                                            target_user_genders: isSelected
                                                                ? d.target_user_genders.filter(id => id !== type.id)
                                                                : [...d.target_user_genders, type.id]
                                                        }));
                                                    }}
                                                >
                                                    {type.label}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Who sees this question first? Their partner will see the Partner Text after they answer. Leave empty for anyone.
                                    </p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save'
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Label className="text-sm text-muted-foreground">Question Type</Label>
                <Select
                    value={questionTypeFilter}
                    onValueChange={(value) => setQuestionTypeFilter(value as QuestionType | 'all')}
                >
                    <SelectTrigger className="w-56">
                        <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {QUESTION_TYPE_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                            {selectedIds.size} question{selectedIds.size !== 1 ? 's' : ''} selected
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            Clear selection
                        </Button>
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                    >
                        {bulkDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete {selectedIds.size} Question{selectedIds.size !== 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* AI Generator Dialog */}
            <AiGeneratorDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                type="questions"
                context={{ packName: pack?.name, packDescription: pack?.description, isExplicit: pack?.is_explicit, existingQuestions: questions.map(q => q.text) }}
                onGenerated={handleAiGenerated}
            />

            <ReviewQuestionsDialog
                open={reviewOpen}
                onOpenChange={setReviewOpen}
                questions={reviewQuestions}
                isExplicit={pack?.is_explicit ?? false}
                onUpdated={fetchData}
            />

            <Dialog open={peekOpen} onOpenChange={setPeekOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Primary Question</DialogTitle>
                        <DialogDescription>
                            Quick peek for the inverse question link.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Primary</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {peekPrimary?.text || 'Primary question not found.'}
                            </p>
                        </div>
                        {peekInverse && (
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Inverse</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {peekInverse.text}
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Questions Table */}
            {
                questions.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center py-12">
                        <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">No questions yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Add questions manually or generate them with AI
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI Generate
                            </Button>
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Question
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={selectedIds.size === questions.length && questions.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Question</TableHead>
                                    <TableHead className="w-28">Type</TableHead>
                                    <TableHead className="w-20">Inverse</TableHead>
                                    <TableHead className="w-32">Partner Text</TableHead>
                                    <TableHead className="w-24">Couples</TableHead>
                                    <TableHead className="w-24">Initiator</TableHead>
                                    <TableHead className="w-24">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {questions.map((question, index) => (
                                    <TableRow
                                        key={question.id}
                                        className={selectedIds.has(question.id) ? 'bg-muted/50' : ''}
                                    >
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(question.id)}
                                                onCheckedChange={() => toggleSelection(question.id)}
                                                aria-label={`Select question ${index + 1}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground">
                                            {(page - 1) * pageSize + index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <span className="line-clamp-2">{question.text}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                                    {getQuestionTypeLabel(question.question_type)}
                                                </Badge>
                                                {getConfigSummary(question) && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {getConfigSummary(question)}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {question.inverse_of ? (
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs border-blue-500 text-blue-500" title="This is an inverse of another question">
                                                        <Link2 className="h-3 w-3 mr-1" />
                                                        Inverse
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handlePeekPrimary(question)}
                                                        aria-label="Peek primary question"
                                                        title="Peek primary question"
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : questions.some(q => q.inverse_of === question.id) ? (
                                                <Badge variant="outline" className="text-xs border-green-500 text-green-500" title="This question has an inverse">
                                                    <Link2 className="h-3 w-3 mr-1" />
                                                    Primary
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {question.partner_text ? (
                                                <Badge variant="secondary" className="text-xs">
                                                    <Users className="h-3 w-3 mr-1" />
                                                    Two-Part
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {question.allowed_couple_genders && question.allowed_couple_genders.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {question.allowed_couple_genders.map(g => (
                                                        <Badge key={g} variant="outline" className="text-[10px] px-1 py-0 h-5">
                                                            {g.replace('male+male', 'M+M').replace('female+male', 'M+F').replace('female+female', 'F+F')}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">All</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {question.target_user_genders && question.target_user_genders.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {question.target_user_genders.map(g => (
                                                        <Badge key={g} variant="outline" className="text-[10px] px-1 py-0 h-5 border-orange-500 text-orange-500">
                                                            {g.charAt(0).toUpperCase()}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Any</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditDialog(question)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(question)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )
            }

            {questions.length > 0 && (
                <PaginationControls
                    page={page}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPage(1);
                        setPageSize(size);
                    }}
                />
            )}
        </div >
    );
}
