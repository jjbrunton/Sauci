import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { useEntityForm } from '@/hooks/useEntityForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, MessageCircle, Pencil, Trash2, Sparkles, Crown, Eye, EyeOff, Flame, Heart, Tags, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { AiGeneratorDialog } from '@/components/ai/AiGeneratorDialog';
import { ExtractTopicsDialog } from '@/components/content/ExtractTopicsDialog';
import { PackFormDialog, type PackFormData } from '@/components/content/PackFormDialog';

// =============================================================================
// Types
// =============================================================================

interface Category {
    id: string;
    name: string;
    icon: string | null;
}

interface Topic {
    id: string;
    name: string;
}

interface QuestionPack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_premium: boolean;
    is_public: boolean;
    is_explicit: boolean;
    sort_order: number | null;
    category_id: string | null;
    created_at: string | null;
    question_count?: number;
    topics?: Topic[];
}

// =============================================================================
// Component
// =============================================================================

export function PacksPage() {
    const { categoryId } = useParams<{ categoryId: string }>();

    // Data state
    const [category, setCategory] = useState<Category | null>(null);
    const [packs, setPacks] = useState<QuestionPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const [extractTopicsDialogOpen, setExtractTopicsDialogOpen] = useState(false);
    const [extractTopicsPack, setExtractTopicsPack] = useState<QuestionPack | null>(null);
    const [allTopics, setAllTopics] = useState<Topic[]>([]);
    const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());

    // Form state using the hook
    const form = useEntityForm<PackFormData, QuestionPack>(
        {
            name: '',
            description: '',
            icon: '💕',
            is_premium: false,
            is_public: false,
            is_explicit: false,
        },
        (pack) => ({
            name: pack.name,
            description: pack.description || '',
            icon: pack.icon || '💕',
            is_premium: pack.is_premium,
            is_public: pack.is_public,
            is_explicit: pack.is_explicit,
        })
    );

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch category info
            if (categoryId) {
                const { data: cat } = await supabase
                    .from('categories')
                    .select('id, name, icon')
                    .eq('id', categoryId)
                    .single();
                setCategory(cat);
            }

            // Fetch packs
            let query = supabase
                .from('question_packs')
                .select('*')
                .order('sort_order', { ascending: true });

            if (categoryId) {
                query = query.eq('category_id', categoryId);
            }

            const { data: packData, error } = await query;
            if (error) throw error;

            // Fetch question counts
            const packIds = (packData || []).map(p => p.id);
            const { data: questions } = await supabase
                .from('questions')
                .select('pack_id')
                .in('pack_id', packIds);

            const questionCounts: Record<string, number> = {};
            questions?.forEach(q => {
                questionCounts[q.pack_id] = (questionCounts[q.pack_id] || 0) + 1;
            });

            // Fetch all topics
            const { data: topicsData } = await supabase
                .from('topics')
                .select('id, name')
                .order('name');
            setAllTopics(topicsData || []);

            // Fetch pack_topics relationships
            const { data: packTopicsData } = await supabase
                .from('pack_topics')
                .select('pack_id, topic_id, topics(id, name)')
                .in('pack_id', packIds);

            const packTopicsMap: Record<string, Topic[]> = {};
            packTopicsData?.forEach((pt: any) => {
                if (!packTopicsMap[pt.pack_id]) {
                    packTopicsMap[pt.pack_id] = [];
                }
                if (pt.topics) {
                    packTopicsMap[pt.pack_id].push(pt.topics);
                }
            });

            setPacks(
                (packData || []).map(p => ({
                    ...p,
                    question_count: questionCounts[p.id] || 0,
                    topics: packTopicsMap[p.id] || [],
                }))
            );
        } catch (error) {
            toast.error('Failed to load packs');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // =============================================================================
    // Handlers
    // =============================================================================

    const openCreate = () => {
        form.openCreate();
        setSelectedTopicIds(new Set());
    };

    const openEdit = (pack: QuestionPack) => {
        form.openEdit(pack);
        setSelectedTopicIds(new Set(pack.topics?.map(t => t.id) || []));
    };

    const handleSave = async () => {
        if (!form.formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        form.setSaving(true);
        try {
            let packId: string;

            if (form.editingItem) {
                const { error } = await auditedSupabase.update('question_packs', form.editingItem.id, {
                    name: form.formData.name,
                    description: form.formData.description || null,
                    icon: form.formData.icon || null,
                    is_premium: form.formData.is_premium,
                    is_public: form.formData.is_public,
                    is_explicit: form.formData.is_explicit,
                });
                if (error) throw error;
                packId = form.editingItem.id;
            } else {
                const { data, error } = await supabase
                    .from('question_packs')
                    .insert({
                        name: form.formData.name,
                        description: form.formData.description || null,
                        icon: form.formData.icon || null,
                        is_premium: form.formData.is_premium,
                        is_public: form.formData.is_public,
                        is_explicit: form.formData.is_explicit,
                        category_id: categoryId || null,
                        sort_order: packs.length,
                    })
                    .select('id')
                    .single();
                if (error) throw error;
                packId = data.id;
            }

            // Update topics
            await supabase.from('pack_topics').delete().eq('pack_id', packId);

            if (selectedTopicIds.size > 0) {
                const { error: topicsError } = await supabase
                    .from('pack_topics')
                    .insert(
                        Array.from(selectedTopicIds).map(topicId => ({
                            pack_id: packId,
                            topic_id: topicId,
                        }))
                    );
                if (topicsError) throw topicsError;
            }

            toast.success(form.isEditing ? 'Pack updated' : 'Pack created');
            form.close();
            fetchData();
        } catch (error) {
            toast.error('Failed to save pack');
            console.error(error);
        } finally {
            form.setSaving(false);
        }
    };

    const handleDelete = async (pack: QuestionPack) => {
        if (!confirm(`Delete pack "${pack.name}"? This will delete all questions in this pack.`)) {
            return;
        }

        try {
            const { error } = await auditedSupabase.delete('question_packs', pack.id);
            if (error) throw error;
            toast.success('Pack deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete pack');
            console.error(error);
        }
    };

    const handleAiGenerated = (result: { name?: string; description?: string; icon?: string }) => {
        if (result.description) {
            form.openCreateWith({
                name: result.name || '',
                description: result.description,
                icon: result.icon || '💕',
                is_premium: false,
                is_public: false,
                is_explicit: false,
            });
            setAiDialogOpen(false);
            setSelectedTopicIds(new Set());
        }
    };

    const handleMove = async (pack: QuestionPack, direction: 'up' | 'down') => {
        const currentIndex = packs.findIndex(p => p.id === pack.id);
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= packs.length) return;

        const targetPack = packs[targetIndex];

        try {
            const currentOrder = pack.sort_order ?? currentIndex;
            const targetOrder = targetPack.sort_order ?? targetIndex;

            await Promise.all([
                auditedSupabase.update('question_packs', pack.id, { sort_order: targetOrder }),
                auditedSupabase.update('question_packs', targetPack.id, { sort_order: currentOrder }),
            ]);

            // Optimistic update
            const newPacks = [...packs];
            [newPacks[currentIndex], newPacks[targetIndex]] = [newPacks[targetIndex], newPacks[currentIndex]];
            setPacks(newPacks);
        } catch (error) {
            toast.error('Failed to reorder packs');
            console.error(error);
            fetchData();
        }
    };

    // =============================================================================
    // Render
    // =============================================================================

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        {category && (
                            <>
                                <span className="text-3xl">{category.icon}</span>
                                {category.name}:
                            </>
                        )}
                        Question Packs
                    </h1>
                    <p className="text-muted-foreground">
                        {category
                            ? `Manage packs in the ${category.name} category`
                            : 'Manage all question packs'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Ideas
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Pack
                    </Button>
                </div>
            </div>

            {/* Pack Form Dialog */}
            <PackFormDialog
                open={form.dialogOpen}
                onOpenChange={form.setDialogOpen}
                formData={form.formData}
                onFormChange={form.setFormData}
                onSave={handleSave}
                saving={form.saving}
                isEditing={form.isEditing}
                allTopics={allTopics}
                selectedTopicIds={selectedTopicIds}
                onTopicsChange={setSelectedTopicIds}
            />

            {/* AI Generator Dialog */}
            <AiGeneratorDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                type="category-pack-ideas"
                context={{
                    categoryName: category?.name,
                    existingPacks: packs.map(p => p.name)
                }}
                onGenerated={handleAiGenerated}
            />

            {/* Extract Topics Dialog */}
            {extractTopicsPack && (
                <ExtractTopicsDialog
                    open={extractTopicsDialogOpen}
                    onOpenChange={setExtractTopicsDialogOpen}
                    pack={extractTopicsPack}
                    onUpdated={fetchData}
                />
            )}

            {/* Packs Grid */}
            {packs.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No packs yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Create your first question pack to get started
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Ideas
                        </Button>
                        <Button onClick={openCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Pack
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {packs.map((pack, index) => (
                        <Card key={pack.id} className="group hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleMove(pack, 'up')}
                                                disabled={index === 0}
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleMove(pack, 'down')}
                                                disabled={index === packs.length - 1}
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="text-4xl mb-2">{pack.icon || '💕'}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {pack.is_premium && (
                                            <Badge variant="default" className="bg-amber-500">
                                                <Crown className="h-3 w-3 mr-1" />
                                                Premium
                                            </Badge>
                                        )}
                                        {pack.is_public ? (
                                            <Badge variant="outline" className="border-green-500 text-green-400">
                                                <Eye className="h-3 w-3 mr-1" />
                                                Published
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                <EyeOff className="h-3 w-3 mr-1" />
                                                Draft
                                            </Badge>
                                        )}
                                        {pack.is_explicit ? (
                                            <Badge variant="outline" className="border-red-500 text-red-400">
                                                <Flame className="h-3 w-3 mr-1" />
                                                Explicit
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-pink-400 text-pink-300">
                                                <Heart className="h-3 w-3 mr-1" />
                                                Safe
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-start justify-between">
                                    <CardTitle className="flex-1">{pack.name}</CardTitle>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setExtractTopicsPack(pack);
                                                setExtractTopicsDialogOpen(true);
                                            }}
                                            title="Extract Topics"
                                        >
                                            <Tags className="h-4 w-4 text-blue-400" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEdit(pack)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(pack)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    {pack.description || 'No description'}
                                </CardDescription>
                                {/* Topics */}
                                {pack.topics && pack.topics.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {pack.topics.map(topic => (
                                            <Badge key={topic.id} variant="outline" className="text-xs">
                                                {topic.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        {pack.question_count} question{pack.question_count !== 1 ? 's' : ''}
                                    </span>
                                    <Link to={`/packs/${pack.id}/questions`}>
                                        <Button variant="outline" size="sm">
                                            Manage Questions
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
