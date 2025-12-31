import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Pencil, Trash2, Sparkles, Loader2, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { AiGeneratorDialog } from '@/components/ai/AiGeneratorDialog';
import { AIPolishButton } from '@/components/ai/AIPolishButton';
import { ReviewQuestionsDialog } from '@/components/content/ReviewQuestionsDialog';

interface QuestionPack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_explicit: boolean;
}

interface Question {
    id: string;
    pack_id: string;
    text: string;
    partner_text: string | null;
    intensity: number;
    allowed_couple_genders: string[] | null;
    target_user_genders: string[] | null;
    created_at: string | null;
}

import { INTENSITY_LEVELS } from '@/lib/openai';

// Helper to get intensity info by level (1-indexed)
const getIntensity = (level: number) => INTENSITY_LEVELS[level - 1] || INTENSITY_LEVELS[0];

export function QuestionsPage() {
    const { packId } = useParams<{ packId: string }>();
    const [pack, setPack] = useState<QuestionPack | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // Form state
    const [formData, setFormData] = useState<{
        text: string;
        partner_text: string;
        intensity: number;
        allowed_couple_genders: string[];
        target_user_genders: string[];
    }>({
        text: '',
        partner_text: '',
        intensity: 1,
        allowed_couple_genders: [],
        target_user_genders: [],
    });

    const fetchData = async () => {
        if (!packId) return;

        setLoading(true);
        try {
            // Fetch pack info
            const { data: packData } = await supabase
                .from('question_packs')
                .select('id, name, description, icon, is_explicit')
                .eq('id', packId)
                .single();

            setPack(packData);

            // Fetch questions
            const { data: questionData, error } = await supabase
                .from('questions')
                .select('*')
                .eq('pack_id', packId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setQuestions(questionData || []);
        } catch (error) {
            toast.error('Failed to load questions');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [packId]);

    const openCreateDialog = () => {
        setEditingQuestion(null);
        setFormData({ text: '', partner_text: '', intensity: 1, allowed_couple_genders: [], target_user_genders: [] });
        setDialogOpen(true);
    };

    const openEditDialog = (question: Question) => {
        setEditingQuestion(question);
        setFormData({
            text: question.text,
            partner_text: question.partner_text || '',
            intensity: question.intensity,
            allowed_couple_genders: question.allowed_couple_genders || [],
            target_user_genders: question.target_user_genders || [],
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.text.trim()) {
            toast.error('Question text is required');
            return;
        }

        setSaving(true);
        try {
            if (editingQuestion) {
                const { error } = await auditedSupabase.update('questions', editingQuestion.id, {
                    text: formData.text,
                    partner_text: formData.partner_text || null,
                    intensity: formData.intensity,
                    allowed_couple_genders: formData.allowed_couple_genders.length > 0 ? formData.allowed_couple_genders : null,
                    target_user_genders: formData.target_user_genders.length > 0 ? formData.target_user_genders : null,
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

    const handleAiGenerated = (generatedQuestions: Array<{ text: string; partner_text?: string; intensity: number }>) => {
        // Bulk insert AI-generated questions
        const insertQuestions = async () => {
            try {
                const { error } = await auditedSupabase.insert(
                    'questions',
                    generatedQuestions.map(q => ({
                        pack_id: packId,
                        text: q.text,
                        partner_text: q.partner_text || null,
                        intensity: q.intensity,
                    }))
                );

                if (error) throw error;
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
                        {pack && (
                            <>
                                <span className="text-3xl">{pack.icon}</span>
                                {pack.name}
                            </>
                        )}
                    </h1>
                    <p className="text-muted-foreground">
                        {questions.length} question{questions.length !== 1 ? 's' : ''} in this pack
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setReviewOpen(true)}>
                        <Sparkles className="mr-2 h-4 w-4" />
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
                                    <Label>Intensity Level</Label>
                                    <div className="flex gap-2">
                                        {INTENSITY_LEVELS.map((intensity) => (
                                            <Button
                                                key={intensity.level}
                                                type="button"
                                                variant={formData.intensity === intensity.level ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setFormData(d => ({ ...d, intensity: intensity.level }))}
                                                className={formData.intensity === intensity.level ? intensity.color : ''}
                                                title={intensity.description}
                                            >
                                                {intensity.level} - {intensity.label}
                                            </Button>
                                        ))}
                                    </div>
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
                questions={questions}
                isExplicit={pack?.is_explicit ?? false}
                onUpdated={fetchData}
            />

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
                                    <TableHead className="w-32">Partner Text</TableHead>
                                    <TableHead className="w-24">Couples</TableHead>
                                    <TableHead className="w-24">Initiator</TableHead>
                                    <TableHead className="w-24">Intensity</TableHead>
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
                                            {index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <span className="line-clamp-2">{question.text}</span>
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
                                            <Badge
                                                className={`${getIntensity(question.intensity).color} text-white`}
                                                title={getIntensity(question.intensity).description}
                                            >
                                                {getIntensity(question.intensity).label}
                                            </Badge>
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
        </div >
    );
}
