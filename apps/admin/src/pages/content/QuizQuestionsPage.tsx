import { useState, useEffect, useCallback } from 'react';
import { adminData } from '@/lib/adminApi';
import { auditedAdminData } from '@/hooks/useAuditedAdminData';
import { useEntityForm } from '@/hooks/useEntityForm';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Loader2, HelpCircle, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_QUIZ_OPTIONS, MIN_QUIZ_OPTIONS, sanitizeQuizOptions, validateQuizQuestionForm } from '@/lib/quizQuestions';

// =============================================================================
// Types
// =============================================================================

interface QuizQuestion {
    id: string;
    prompt_self: string;
    prompt_guess: string;
    options: string[];
    sort_order: number;
    is_active: boolean;
    created_at: string | null;
}

interface QuizQuestionFormData {
    prompt_self: string;
    prompt_guess: string;
    options: string[];
    sort_order: string;
    is_active: boolean;
}

type ActiveFilter = 'all' | 'active' | 'inactive';

const emptyOptions = () => ['', ''];

// =============================================================================
// Component
// =============================================================================

export function QuizQuestionsPage() {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalCount, setTotalCount] = useState(0);
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

    const form = useEntityForm<QuizQuestionFormData, QuizQuestion>(
        {
            prompt_self: '',
            prompt_guess: '',
            options: emptyOptions(),
            sort_order: '0',
            is_active: true,
        },
        (question) => ({
            prompt_self: question.prompt_self,
            prompt_guess: question.prompt_guess,
            options: question.options.length ? [...question.options] : emptyOptions(),
            sort_order: String(question.sort_order),
            is_active: question.is_active,
        })
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = adminData
                .from('quiz_questions')
                .select('*', { count: 'exact' })
                .order('sort_order', { ascending: true })
                .range(from, to);

            if (activeFilter === 'active') {
                query = query.eq('is_active', true);
            } else if (activeFilter === 'inactive') {
                query = query.eq('is_active', false);
            }

            const { data, error, count } = await query;
            if (error) throw error;
            setTotalCount(count || 0);
            setQuestions((data as QuizQuestion[]) || []);
        } catch (error) {
            toast.error('Failed to load quiz questions');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, activeFilter]);

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
    }, [activeFilter]);

    // =============================================================================
    // Option helpers
    // =============================================================================

    const setOption = (index: number, value: string) => {
        form.setFields({
            options: form.formData.options.map((opt, i) => (i === index ? value : opt)),
        });
    };

    const addOption = () => {
        if (form.formData.options.length >= MAX_QUIZ_OPTIONS) return;
        form.setFields({ options: [...form.formData.options, ''] });
    };

    const removeOption = (index: number) => {
        if (form.formData.options.length <= MIN_QUIZ_OPTIONS) return;
        form.setFields({ options: form.formData.options.filter((_, i) => i !== index) });
    };

    // =============================================================================
    // Handlers
    // =============================================================================

    const handleSave = async () => {
        const validationError = validateQuizQuestionForm(form.formData);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        const cleanedOptions = sanitizeQuizOptions(form.formData.options);
        const parsedSortOrder = Number(form.formData.sort_order);
        const sortOrder = Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0;

        const payload = {
            prompt_self: form.formData.prompt_self.trim(),
            prompt_guess: form.formData.prompt_guess.trim(),
            options: cleanedOptions,
            sort_order: sortOrder,
            is_active: form.formData.is_active,
        };

        form.setSaving(true);
        try {
            if (form.editingItem) {
                const { error } = await auditedAdminData.update('quiz_questions', form.editingItem.id, payload);
                if (error) throw error;
                toast.success('Quiz question updated');
            } else {
                const { error } = await auditedAdminData.insert('quiz_questions', payload);
                if (error) throw error;
                toast.success('Quiz question created');
            }

            form.close();
            fetchData();
        } catch (error) {
            toast.error('Failed to save quiz question');
            console.error(error);
        } finally {
            form.setSaving(false);
        }
    };

    const handleToggleActive = async (question: QuizQuestion) => {
        try {
            const { error } = await auditedAdminData.update('quiz_questions', question.id, {
                is_active: !question.is_active,
            });
            if (error) throw error;
            toast.success(question.is_active ? 'Quiz question deactivated' : 'Quiz question activated');
            fetchData();
        } catch (error) {
            toast.error('Failed to update quiz question');
            console.error(error);
        }
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
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <HelpCircle className="h-8 w-8 text-purple-500" />
                        Quiz Questions
                    </h1>
                    <p className="text-muted-foreground">
                        {totalCount} question{totalCount !== 1 ? 's' : ''} in the couples quiz pool
                    </p>
                </div>
                <Dialog open={form.dialogOpen} onOpenChange={form.setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={form.openCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Question
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {form.isEditing ? 'Edit Quiz Question' : 'Add Quiz Question'}
                            </DialogTitle>
                            <DialogDescription>
                                {form.isEditing
                                    ? 'Update the quiz question details below.'
                                    : 'Add a new question to the couples quiz pool.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="prompt_self">Prompt (about yourself)</Label>
                                <Textarea
                                    id="prompt_self"
                                    value={form.formData.prompt_self}
                                    onChange={(e) => form.setField('prompt_self', e.target.value)}
                                    placeholder="e.g., What is your idea of a perfect date night?"
                                    rows={2}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Shown when a partner answers about themselves.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="prompt_guess">Prompt (guessing about partner)</Label>
                                <Textarea
                                    id="prompt_guess"
                                    value={form.formData.prompt_guess}
                                    onChange={(e) => form.setField('prompt_guess', e.target.value)}
                                    placeholder="e.g., What is your partner's idea of a perfect date night?"
                                    rows={2}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Shown when a partner guesses the other partner's answer. Same options, different phrasing.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Options ({MIN_QUIZ_OPTIONS}-{MAX_QUIZ_OPTIONS})</Label>
                                    {form.formData.options.length < MAX_QUIZ_OPTIONS && (
                                        <Button type="button" variant="outline" size="sm" onClick={addOption}>
                                            <Plus className="mr-1 h-3 w-3" />
                                            Add Option
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {form.formData.options.map((option, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                value={option}
                                                onChange={(e) => setOption(index, e.target.value)}
                                                placeholder={`Option ${index + 1}`}
                                            />
                                            {form.formData.options.length > MIN_QUIZ_OPTIONS && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeOption(index)}
                                                    aria-label={`Remove option ${index + 1}`}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Both partners choose from the same list of options.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sort_order">Sort Order</Label>
                                <Input
                                    id="sort_order"
                                    type="number"
                                    value={form.formData.sort_order}
                                    onChange={(e) => form.setField('sort_order', e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Lower numbers are considered before higher numbers when questions have equal usage history.
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Active</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Inactive questions are never selected for a new quiz session.
                                    </p>
                                </div>
                                <Switch
                                    checked={form.formData.is_active}
                                    onCheckedChange={(checked) => form.setField('is_active', checked)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={form.close}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={form.saving}>
                                {form.saving ? (
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

            <div className="flex flex-wrap items-center gap-3">
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as ActiveFilter)}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="All questions" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All questions</SelectItem>
                        <SelectItem value="active">Active only</SelectItem>
                        <SelectItem value="inactive">Inactive only</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Quiz Questions Table */}
            {questions.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                    <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No quiz questions yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Add questions to build the couples quiz pool
                    </p>
                    <Button onClick={form.openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Question
                    </Button>
                </Card>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-16">Order</TableHead>
                                <TableHead>Prompt</TableHead>
                                <TableHead>Options</TableHead>
                                <TableHead className="w-24">Status</TableHead>
                                <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {questions.map((question) => (
                                <TableRow key={question.id}>
                                    <TableCell className="font-medium text-muted-foreground">
                                        {question.sort_order}
                                    </TableCell>
                                    <TableCell>
                                        <p className="line-clamp-2 font-medium">{question.prompt_self}</p>
                                        <p className="line-clamp-1 text-xs text-muted-foreground">{question.prompt_guess}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {question.options.map((option, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {option}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={question.is_active ? 'default' : 'secondary'}>
                                            {question.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => form.openEdit(question)}
                                                aria-label="Edit question"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleToggleActive(question)}
                                                aria-label={question.is_active ? 'Deactivate question' : 'Activate question'}
                                                title={question.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {question.is_active ? (
                                                    <EyeOff className="h-4 w-4 text-destructive" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-green-500" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

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
        </div>
    );
}
