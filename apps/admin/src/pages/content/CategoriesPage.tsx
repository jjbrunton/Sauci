import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { useEntityForm } from '@/hooks/useEntityForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from '@/components/ui/emoji-picker';
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
import { Plus, Package, Pencil, Trash2, Sparkles, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { AiGeneratorDialog } from '@/components/ai/AiGeneratorDialog';
import { AIPolishButton } from '@/components/ai/AIPolishButton';

// =============================================================================
// Types
// =============================================================================

interface Category {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    sort_order: number | null;
    created_at: string | null;
    pack_count?: number;
}

interface CategoryFormData {
    name: string;
    description: string;
    icon: string;
}

// =============================================================================
// Component
// =============================================================================

export function CategoriesPage() {
    // Data state
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiIdeasOpen, setAiIdeasOpen] = useState(false);

    // Form state using the new hook
    const form = useEntityForm<CategoryFormData, Category>(
        { name: '', description: '', icon: '📚' },
        (category) => ({
            name: category.name,
            description: category.description || '',
            icon: category.icon || '📚',
        })
    );

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch categories with pack count
            const { data: cats, error } = await supabase
                .from('categories')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;

            // Fetch pack counts per category
            const { data: packs } = await supabase
                .from('question_packs')
                .select('category_id');

            const packCounts: Record<string, number> = {};
            packs?.forEach(p => {
                if (p.category_id) {
                    packCounts[p.category_id] = (packCounts[p.category_id] || 0) + 1;
                }
            });

            setCategories(
                (cats || []).map(c => ({
                    ...c,
                    pack_count: packCounts[c.id] || 0,
                }))
            );
        } catch (error) {
            toast.error('Failed to load categories');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    // =============================================================================
    // Handlers
    // =============================================================================

    const handleAiIdea = (idea: { name: string; description?: string; icon?: string }) => {
        setAiIdeasOpen(false);
        form.openCreateWith({
            name: idea.name,
            description: idea.description || '',
            icon: idea.icon || '📚',
        });
    };

    const handleSave = async () => {
        if (!form.formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        form.setSaving(true);
        try {
            const data = {
                name: form.formData.name,
                description: form.formData.description || null,
                icon: form.formData.icon || null,
            };

            if (form.editingItem) {
                const { error } = await auditedSupabase.update('categories', form.editingItem.id, data);
                if (error) throw error;
                toast.success('Category updated');
            } else {
                const { error } = await auditedSupabase.insert('categories', {
                    ...data,
                    sort_order: categories.length,
                });
                if (error) throw error;
                toast.success('Category created');
            }

            form.close();
            fetchCategories();
        } catch (error) {
            toast.error('Failed to save category');
            console.error(error);
        } finally {
            form.setSaving(false);
        }
    };

    const handleDelete = async (category: Category) => {
        if (!confirm(`Delete category "${category.name}"? This will not delete associated packs.`)) {
            return;
        }

        try {
            const { error } = await auditedSupabase.delete('categories', category.id);
            if (error) throw error;
            toast.success('Category deleted');
            fetchCategories();
        } catch (error) {
            toast.error('Failed to delete category');
            console.error(error);
        }
    };

    const handleMove = async (category: Category, direction: 'up' | 'down') => {
        const currentIndex = categories.findIndex(c => c.id === category.id);
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= categories.length) return;

        const targetCategory = categories[targetIndex];

        try {
            const currentOrder = category.sort_order ?? currentIndex;
            const targetOrder = targetCategory.sort_order ?? targetIndex;

            await Promise.all([
                auditedSupabase.update('categories', category.id, { sort_order: targetOrder }),
                auditedSupabase.update('categories', targetCategory.id, { sort_order: currentOrder }),
            ]);

            // Optimistic update
            const newCategories = [...categories];
            [newCategories[currentIndex], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[currentIndex]];
            setCategories(newCategories);
        } catch (error) {
            toast.error('Failed to reorder categories');
            console.error(error);
            fetchCategories();
        }
    };

    // =============================================================================
    // Render
    // =============================================================================

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-9 w-48" />
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
                    <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
                    <p className="text-muted-foreground">
                        Organize your question packs into categories
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={form.dialogOpen} onOpenChange={form.setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={form.openCreate}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Category
                            </Button>
                        </DialogTrigger>
                        <Button variant="outline" onClick={() => setAiIdeasOpen(true)}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Ideas
                        </Button>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {form.isEditing ? 'Edit Category' : 'Create Category'}
                                </DialogTitle>
                                <DialogDescription>
                                    {form.isEditing
                                        ? 'Update the category details below.'
                                        : 'Add a new category to organize your question packs.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Icon</Label>
                                    <EmojiPicker
                                        value={form.formData.icon}
                                        onChange={(emoji) => form.setField('icon', emoji)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="name">Name</Label>
                                        <AIPolishButton
                                            text={form.formData.name}
                                            type="category_name"
                                            onPolished={(val) => form.setField('name', val)}
                                        />
                                    </div>
                                    <Input
                                        id="name"
                                        value={form.formData.name}
                                        onChange={(e) => form.setField('name', e.target.value)}
                                        placeholder="e.g., Romance"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="description">Description</Label>
                                        <AIPolishButton
                                            text={form.formData.description}
                                            type="pack_description"
                                            onPolished={(val) => form.setField('description', val)}
                                        />
                                    </div>
                                    <Textarea
                                        id="description"
                                        value={form.formData.description}
                                        onChange={(e) => form.setField('description', e.target.value)}
                                        placeholder="Describe this category..."
                                        rows={3}
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
            </div>

            {/* Categories Grid */}
            {categories.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No categories yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Create your first category to get started
                    </p>
                    <Button onClick={form.openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category, index) => (
                        <Card key={category.id} className="group hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleMove(category, 'up')}
                                                disabled={index === 0}
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleMove(category, 'down')}
                                                disabled={index === categories.length - 1}
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="text-4xl mb-2">{category.icon || '📚'}</div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => form.openEdit(category)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(category)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                                <CardTitle>{category.name}</CardTitle>
                                <CardDescription className="line-clamp-2">
                                    {category.description || 'No description'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        {category.pack_count} pack{category.pack_count !== 1 ? 's' : ''}
                                    </span>
                                    <Link to={`/categories/${category.id}/packs`}>
                                        <Button variant="outline" size="sm">
                                            View Packs
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* AI Dialog */}
            <AiGeneratorDialog
                open={aiIdeasOpen}
                onOpenChange={setAiIdeasOpen}
                type="category-ideas"
                context={{
                    existingCategories: categories.map(c => c.name),
                }}
                onGenerated={handleAiIdea}
            />
        </div>
    );
}
