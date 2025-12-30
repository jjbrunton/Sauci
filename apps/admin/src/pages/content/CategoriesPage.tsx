import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
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
import { Plus, Package, Pencil, Trash2, Sparkles, Loader2, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { AiGeneratorDialog } from '@/components/ai/AiGeneratorDialog';
import { AIPolishButton } from '@/components/ai/AIPolishButton';

interface Category {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    sort_order: number | null;
    created_at: string | null;
    pack_count?: number;
}

export function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [saving, setSaving] = useState(false);
    const [aiIdeasOpen, setAiIdeasOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '📚',
    });

    const fetchCategories = async () => {
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
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const openCreateDialog = () => {
        setEditingCategory(null);
        setFormData({ name: '', description: '', icon: '📚' });
        setDialogOpen(true);
    };

    const openEditDialog = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            description: category.description || '',
            icon: category.icon || '📚',
        });
        setDialogOpen(true);
    };

    const handleAiIdea = (idea: any) => {
        setAiIdeasOpen(false);
        setEditingCategory(null);
        setFormData({
            name: idea.name,
            description: idea.description || '',
            icon: idea.icon,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        setSaving(true);
        try {
            if (editingCategory) {
                // Update
                const { error } = await auditedSupabase.update('categories', editingCategory.id, {
                    name: formData.name,
                    description: formData.description || null,
                    icon: formData.icon || null,
                });

                if (error) throw error;
                toast.success('Category updated');
            } else {
                // Create
                const { error } = await auditedSupabase.insert('categories', {
                    name: formData.name,
                    description: formData.description || null,
                    icon: formData.icon || null,
                    sort_order: categories.length,
                });

                if (error) throw error;
                toast.success('Category created');
            }

            setDialogOpen(false);
            fetchCategories();
        } catch (error) {
            toast.error('Failed to save category');
            console.error(error);
        } finally {
            setSaving(false);
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
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreateDialog}>
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
                                    {editingCategory ? 'Edit Category' : 'Create Category'}
                                </DialogTitle>
                                <DialogDescription>
                                    {editingCategory
                                        ? 'Update the category details below.'
                                        : 'Add a new category to organize your question packs.'}
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
                                            type="category_name"
                                            onPolished={(val) => setFormData(d => ({ ...d, name: val }))}
                                        />
                                    </div>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData(d => ({ ...d, name: e.target.value }))}
                                        placeholder="e.g., Romance"
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
                                        placeholder="Describe this category..."
                                        rows={3}
                                    />
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

            {/* Categories Grid */}
            {categories.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No categories yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Create your first category to get started
                    </p>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                        <Card key={category.id} className="group hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="text-4xl mb-2">{category.icon || '📚'}</div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(category)}
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
