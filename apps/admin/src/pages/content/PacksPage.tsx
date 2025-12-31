import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, MessageCircle, Pencil, Trash2, Sparkles, Loader2, Crown, Eye, EyeOff, Flame, Heart, Tags, X } from 'lucide-react';
import { toast } from 'sonner';
import { AiGeneratorDialog } from '@/components/ai/AiGeneratorDialog';
import { AIPolishButton } from '@/components/ai/AIPolishButton';
import { ExtractTopicsDialog } from '@/components/content/ExtractTopicsDialog';

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

export function PacksPage() {
    const { categoryId } = useParams<{ categoryId: string }>();
    const [category, setCategory] = useState<Category | null>(null);
    const [packs, setPacks] = useState<QuestionPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const [editingPack, setEditingPack] = useState<QuestionPack | null>(null);
    const [saving, setSaving] = useState(false);
    const [extractTopicsDialogOpen, setExtractTopicsDialogOpen] = useState(false);
    const [extractTopicsPack, setExtractTopicsPack] = useState<QuestionPack | null>(null);
    const [allTopics, setAllTopics] = useState<Topic[]>([]);
    const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '💕',
        is_premium: false,
        is_public: true,
        is_explicit: false,
    });

    const fetchData = async () => {
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
    };

    useEffect(() => {
        fetchData();
    }, [categoryId]);

    const openCreateDialog = () => {
        setEditingPack(null);
        setFormData({
            name: '',
            description: '',
            icon: '💕',
            is_premium: false,
            is_public: true,
            is_explicit: false,
        });
        setSelectedTopicIds(new Set());
        setDialogOpen(true);
    };

    const openEditDialog = (pack: QuestionPack) => {
        setEditingPack(pack);
        setFormData({
            name: pack.name,
            description: pack.description || '',
            icon: pack.icon || '💕',
            is_premium: pack.is_premium,
            is_public: pack.is_public,
            is_explicit: pack.is_explicit,
        });
        setSelectedTopicIds(new Set(pack.topics?.map(t => t.id) || []));
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        setSaving(true);
        try {
            let packId: string;

            if (editingPack) {
                const { error } = await auditedSupabase.update('question_packs', editingPack.id, {
                    name: formData.name,
                    description: formData.description || null,
                    icon: formData.icon || null,
                    is_premium: formData.is_premium,
                    is_public: formData.is_public,
                    is_explicit: formData.is_explicit,
                });

                if (error) throw error;
                packId = editingPack.id;
            } else {
                const { data, error } = await supabase
                    .from('question_packs')
                    .insert({
                        name: formData.name,
                        description: formData.description || null,
                        icon: formData.icon || null,
                        is_premium: formData.is_premium,
                        is_public: formData.is_public,
                        is_explicit: formData.is_explicit,
                        category_id: categoryId || null,
                        sort_order: packs.length,
                    })
                    .select('id')
                    .single();

                if (error) throw error;
                packId = data.id;
            }

            // Update topics - delete existing and insert new
            await supabase
                .from('pack_topics')
                .delete()
                .eq('pack_id', packId);

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

            toast.success(editingPack ? 'Pack updated' : 'Pack created');
            setDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to save pack');
            console.error(error);
        } finally {
            setSaving(false);
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

    const handleAiGenerated = (result: any) => {
        // Handle pack generation
        if (result.description) {
            setFormData({
                ...formData,
                name: result.name,
                description: result.description,
                icon: result.icon || '💕',
            });
            setAiDialogOpen(false);
            setDialogOpen(true);
        }
    };

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
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Pack
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingPack ? 'Edit Pack' : 'Create Pack'}
                                </DialogTitle>
                                <DialogDescription>
                                    {editingPack
                                        ? 'Update the pack details below.'
                                        : 'Add a new question pack to this category.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Icon</Label>
                                    <EmojiPicker
                                        value={formData.icon}
                                        onChange={(emoji) => setFormData(d => ({ ...d, icon: emoji }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="name">Name</Label>
                                        <AIPolishButton
                                            text={formData.name}
                                            type="pack_name"
                                            onPolished={(val) => setFormData(d => ({ ...d, name: val }))}
                                        />
                                    </div>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData(d => ({ ...d, name: e.target.value }))}
                                        placeholder="e.g., 36 Questions to Fall in Love"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="description">Description</Label>
                                        <AIPolishButton
                                            text={formData.description}
                                            type="pack_description"
                                            onPolished={(val) => setFormData(d => ({ ...d, description: val }))}
                                        />
                                    </div>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))}
                                        placeholder="Describe this pack..."
                                        rows={3}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Premium Pack</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Only available to premium users
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.is_premium}
                                        onCheckedChange={(checked) =>
                                            setFormData(d => ({ ...d, is_premium: checked }))
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Public</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Visible to all users by default
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.is_public}
                                        onCheckedChange={(checked) =>
                                            setFormData(d => ({ ...d, is_public: checked }))
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Explicit Content</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Contains adult or mature content
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.is_explicit}
                                        onCheckedChange={(checked) =>
                                            setFormData(d => ({ ...d, is_explicit: checked }))
                                        }
                                    />
                                </div>

                                {/* Topics */}
                                <div className="space-y-2">
                                    <Label>Topics</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Select topics/kinks for filtering
                                    </p>
                                    {/* Selected topics */}
                                    {selectedTopicIds.size > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {Array.from(selectedTopicIds).map(id => {
                                                const topic = allTopics.find(t => t.id === id);
                                                if (!topic) return null;
                                                return (
                                                    <Badge
                                                        key={id}
                                                        variant="secondary"
                                                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                                        onClick={() => {
                                                            const next = new Set(selectedTopicIds);
                                                            next.delete(id);
                                                            setSelectedTopicIds(next);
                                                        }}
                                                    >
                                                        {topic.name}
                                                        <X className="h-3 w-3 ml-1" />
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Available topics */}
                                    {allTopics.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 p-2 border rounded-md max-h-32 overflow-y-auto">
                                            {allTopics
                                                .filter(t => !selectedTopicIds.has(t.id))
                                                .map(topic => (
                                                    <Badge
                                                        key={topic.id}
                                                        variant="outline"
                                                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                                        onClick={() => {
                                                            const next = new Set(selectedTopicIds);
                                                            next.add(topic.id);
                                                            setSelectedTopicIds(next);
                                                        }}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        {topic.name}
                                                    </Badge>
                                                ))}
                                            {allTopics.filter(t => !selectedTopicIds.has(t.id)).length === 0 && (
                                                <span className="text-xs text-muted-foreground">All topics selected</span>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">
                                            No topics yet. Use "Extract Topics" on a pack to create some.
                                        </p>
                                    )}
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
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Pack
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {packs.map((pack) => (
                        <Card key={pack.id} className="group hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="text-4xl mb-2">{pack.icon || '💕'}</div>
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
                                            onClick={() => openEditDialog(pack)}
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
