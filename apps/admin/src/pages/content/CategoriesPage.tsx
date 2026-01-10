import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { useEntityForm } from '@/hooks/useEntityForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { IconPicker, IconPreview } from '@/components/ui/icon-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
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
    is_public: boolean;
    pack_count?: number;
}

interface CategoryFormData {
    name: string;
    description: string;
    icon: string;
    is_public: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function CategoriesPage() {
    // Data state
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiIdeasOpen, setAiIdeasOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [totalCount, setTotalCount] = useState(0);

    // Form state using the new hook
    const form = useEntityForm<CategoryFormData, Category>(
        { name: '', description: '', icon: 'bookmark-outline', is_public: true },
        (category) => ({
            name: category.name,
            description: category.description || '',
            icon: category.icon || 'bookmark-outline',
            is_public: category.is_public ?? true,
        })
    );

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data: cats, error, count } = await supabase
                .from('categories')
                .select('*', { count: 'exact' })
                .order('sort_order', { ascending: true })
                .range(from, to);

            if (error) throw error;

            setTotalCount(count || 0);

            const categoryIds = (cats || []).map(c => c.id);
            const packCounts: Record<string, number> = {};

            if (categoryIds.length > 0) {
                const { data: packs } = await supabase
                    .from('question_packs')
                    .select('category_id')
                    .in('category_id', categoryIds);

                packs?.forEach(p => {
                    if (p.category_id) {
                        packCounts[p.category_id] = (packCounts[p.category_id] || 0) + 1;
                    }
                });
            }

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
    }, [page, pageSize]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, pageSize, totalCount]);

    // =============================================================================
    // Handlers
    // =============================================================================

    const handleAiIdea = (idea: { name: string; description?: string; icon?: string }) => {
        setAiIdeasOpen(false);
        form.openCreateWith({
            name: idea.name,
            description: idea.description || '',
            icon: idea.icon || 'bookmark-outline',
            is_public: true,
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
                is_public: form.formData.is_public,
            };

            if (form.editingItem) {
                const { error } = await auditedSupabase.update('categories', form.editingItem.id, data);
                if (error) throw error;
                toast.success('Category updated');
            } else {
                const { error } = await auditedSupabase.insert('categories', {
                    ...data,
                    sort_order: totalCount,
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

            const [currentUpdate, targetUpdate] = await Promise.all([
                auditedSupabase.update('categories', category.id, { sort_order: targetOrder }),
                auditedSupabase.update('categories', targetCategory.id, { sort_order: currentOrder }),
            ]);

            if (currentUpdate.error || targetUpdate.error) {
                throw currentUpdate.error ?? targetUpdate.error ?? new Error('Failed to update category order');
            }

            // Optimistic update
            const newCategories = [...categories];
            newCategories[currentIndex] = { ...targetCategory, sort_order: currentOrder };
            newCategories[targetIndex] = { ...category, sort_order: targetOrder };
            setCategories(newCategories);
        } catch (error) {
            toast.error('Failed to reorder categories');
            console.error(error);
            fetchCategories();
        }
    };

    const handleToggleVisibility = async (category: Category) => {
        try {
            // Optimistic update
            setCategories(categories.map(c =>
                c.id === category.id ? { ...c, is_public: !c.is_public } : c
            ));

            const { error } = await auditedSupabase.update('categories', category.id, {
                is_public: !category.is_public
            });

            if (error) throw error;
            
            toast.success(category.is_public ? 'Category hidden' : 'Category made public');
        } catch (error) {
            toast.error('Failed to update visibility');
            console.error(error);
            fetchCategories(); // Revert
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
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Categories</h1>
                    <p className="text-muted-foreground text-sm">
                        Organize your question packs into categories
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={form.dialogOpen} onOpenChange={form.setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={form.openCreate}>
                                <Plus className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Add Category</span>
                                <span className="sm:hidden">Add</span>
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
                                    <IconPicker
                                        value={form.formData.icon}
                                        onChange={(iconName) => form.setField('icon', iconName)}
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

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Public</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Visible to users in the app
                                        </p>
                                    </div>
                                    <Switch
                                        checked={form.formData.is_public}
                                        onCheckedChange={(checked) => form.setField('is_public', checked)}
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
                        <Card key={category.id} className="group flex flex-col hover:border-primary/50 transition-colors">
                            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                                <div className="rounded-lg bg-primary/10 p-2.5">
                                    <IconPreview value={category.icon} className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                        {category.is_public ? 'Public' : 'Hidden'}
                                    </span>
                                    <Switch
                                        checked={category.is_public}
                                        onCheckedChange={() => handleToggleVisibility(category)}
                                        className="scale-75 origin-right"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg">{category.name}</CardTitle>
                                    <CardDescription className="line-clamp-2 h-10">
                                        {category.description || 'No description'}
                                    </CardDescription>
                                </div>

                                <div className="flex items-center justify-between mt-auto">
                                    <Badge variant="secondary" className="font-normal">
                                        {category.pack_count} pack{category.pack_count !== 1 ? 's' : ''}
                                    </Badge>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex flex-col gap-0.5 mr-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 rounded-full"
                                                onClick={() => handleMove(category, 'up')}
                                                disabled={index === 0}
                                            >
                                                <ChevronUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 rounded-full"
                                                onClick={() => handleMove(category, 'down')}
                                                disabled={index === categories.length - 1}
                                            >
                                                <ChevronDown className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => form.openEdit(category)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDelete(category)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <Link to={`/categories/${category.id}/packs`}>
                                    <Button variant="outline" className="w-full">
                                        View Packs
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {categories.length > 0 && (
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
