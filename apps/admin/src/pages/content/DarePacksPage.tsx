import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { useEntityForm } from '@/hooks/useEntityForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Zap, Pencil, Trash2, Loader2, Crown, Eye, EyeOff, Flame, Heart, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

interface Category {
    id: string;
    name: string;
}

interface DarePack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_premium: boolean;
    is_public: boolean;
    is_explicit: boolean;
    sort_order: number;
    category_id: string | null;
    min_intensity: number | null;
    max_intensity: number | null;
    avg_intensity: number | null;
    created_at: string | null;
    dare_count?: number;
}

interface DarePackFormData {
    name: string;
    description: string;
    icon: string;
    is_premium: boolean;
    is_public: boolean;
    is_explicit: boolean;
    category_id: string;
}

// =============================================================================
// Component
// =============================================================================

export function DarePacksPage() {
    // Data state
    const [darePacks, setDarePacks] = useState<DarePack[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [totalCount, setTotalCount] = useState(0);

    // Form state using the hook
    const form = useEntityForm<DarePackFormData, DarePack>(
        {
            name: '',
            description: '',
            icon: 'flame-outline',
            is_premium: false,
            is_public: false,
            is_explicit: false,
            category_id: '',
        },
        (pack) => ({
            name: pack.name,
            description: pack.description || '',
            icon: pack.icon || 'flame-outline',
            is_premium: pack.is_premium,
            is_public: pack.is_public,
            is_explicit: pack.is_explicit,
            category_id: pack.category_id || '',
        })
    );

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            // Fetch dare packs
            const { data: packData, error, count } = await supabase
                .from('dare_packs')
                .select('*', { count: 'exact' })
                .order('sort_order', { ascending: true })
                .range(from, to);

            if (error) throw error;

            setTotalCount(count || 0);

            // Fetch dare counts
            const packIds = (packData || []).map(p => p.id);
            const dareCounts: Record<string, number> = {};

            if (packIds.length > 0) {
                const { data: dares } = await supabase
                    .from('dares')
                    .select('pack_id')
                    .in('pack_id', packIds);

                dares?.forEach(d => {
                    dareCounts[d.pack_id] = (dareCounts[d.pack_id] || 0) + 1;
                });
            }

            // Fetch categories
            const { data: categoryData } = await supabase
                .from('categories')
                .select('id, name')
                .order('name');

            setCategories(categoryData || []);

            setDarePacks(
                (packData || []).map(p => ({
                    ...p,
                    dare_count: dareCounts[p.id] || 0,
                }))
            );
        } catch (error) {
            toast.error('Failed to load dare packs');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, pageSize, totalCount]);

    // =============================================================================
    // Handlers
    // =============================================================================

    const handleSave = async () => {
        if (!form.formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        form.setSaving(true);
        try {
            if (form.editingItem) {
                const { error } = await auditedSupabase.update('dare_packs', form.editingItem.id, {
                    name: form.formData.name,
                    description: form.formData.description || null,
                    icon: form.formData.icon || null,
                    is_premium: form.formData.is_premium,
                    is_public: form.formData.is_public,
                    is_explicit: form.formData.is_explicit,
                    category_id: form.formData.category_id || null,
                });
                if (error) throw error;
                toast.success('Dare pack updated');
            } else {
                const { error } = await auditedSupabase.insert('dare_packs', {
                    name: form.formData.name,
                    description: form.formData.description || null,
                    icon: form.formData.icon || null,
                    is_premium: form.formData.is_premium,
                    is_public: form.formData.is_public,
                    is_explicit: form.formData.is_explicit,
                    category_id: form.formData.category_id || null,
                    sort_order: totalCount,
                });
                if (error) throw error;
                toast.success('Dare pack created');
            }

            form.close();
            fetchData();
        } catch (error) {
            toast.error('Failed to save dare pack');
            console.error(error);
        } finally {
            form.setSaving(false);
        }
    };

    const handleDelete = async (pack: DarePack) => {
        if (!confirm(`Delete dare pack "${pack.name}"? This will delete all dares in this pack.`)) {
            return;
        }

        try {
            const { error } = await auditedSupabase.delete('dare_packs', pack.id);
            if (error) throw error;
            toast.success('Dare pack deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete dare pack');
            console.error(error);
        }
    };

    const handleMove = async (pack: DarePack, direction: 'up' | 'down') => {
        const currentIndex = darePacks.findIndex(p => p.id === pack.id);
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= darePacks.length) return;

        const targetPack = darePacks[targetIndex];

        try {
            const currentOrder = pack.sort_order ?? currentIndex;
            const targetOrder = targetPack.sort_order ?? targetIndex;

            await Promise.all([
                auditedSupabase.update('dare_packs', pack.id, { sort_order: targetOrder }),
                auditedSupabase.update('dare_packs', targetPack.id, { sort_order: currentOrder }),
            ]);

            // Optimistic update
            const newPacks = [...darePacks];
            [newPacks[currentIndex], newPacks[targetIndex]] = [newPacks[targetIndex], newPacks[currentIndex]];
            setDarePacks(newPacks);
        } catch (error) {
            toast.error('Failed to reorder dare packs');
            console.error(error);
            fetchData();
        }
    };

    const getIntensityColor = (avg: number | null) => {
        if (avg === null) return 'bg-muted';
        if (avg <= 1.5) return 'bg-green-500';
        if (avg <= 2.5) return 'bg-lime-500';
        if (avg <= 3.5) return 'bg-yellow-500';
        if (avg <= 4.5) return 'bg-orange-500';
        return 'bg-red-500';
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
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Zap className="h-8 w-8 text-orange-500" />
                        Dare Packs
                    </h1>
                    <p className="text-muted-foreground">
                        Manage dare packs that users can send to their partners
                    </p>
                </div>
                <Dialog open={form.dialogOpen} onOpenChange={form.setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={form.openCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Dare Pack
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {form.isEditing ? 'Edit Dare Pack' : 'Create Dare Pack'}
                            </DialogTitle>
                            <DialogDescription>
                                {form.isEditing
                                    ? 'Update the dare pack details below.'
                                    : 'Add a new dare pack for couples to challenge each other.'}
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
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={form.formData.name}
                                    onChange={(e) => form.setField('name', e.target.value)}
                                    placeholder="e.g., Romantic Dares"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={form.formData.description}
                                    onChange={(e) => form.setField('description', e.target.value)}
                                    placeholder="Describe this dare pack..."
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Category (optional)</Label>
                                <Select
                                    value={form.formData.category_id || '__none__'}
                                    onValueChange={(value) => form.setField('category_id', value === '__none__' ? '' : value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No category</SelectItem>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Premium</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Only available to premium users
                                    </p>
                                </div>
                                <Switch
                                    checked={form.formData.is_premium}
                                    onCheckedChange={(checked) => form.setField('is_premium', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Published</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Visible to users in the app
                                    </p>
                                </div>
                                <Switch
                                    checked={form.formData.is_public}
                                    onCheckedChange={(checked) => form.setField('is_public', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Explicit</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Contains adult/explicit content
                                    </p>
                                </div>
                                <Switch
                                    checked={form.formData.is_explicit}
                                    onCheckedChange={(checked) => form.setField('is_explicit', checked)}
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

            {/* Dare Packs Grid */}
            {darePacks.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                    <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No dare packs yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Create your first dare pack to get started
                    </p>
                    <Button onClick={form.openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Dare Pack
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {darePacks.map((pack, index) => (
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
                                                disabled={index === darePacks.length - 1}
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="text-4xl mb-2">
                                            <IconPreview value={pack.icon} fallback="flame-outline" className="text-4xl" />
                                        </div>
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
                                            onClick={() => form.openEdit(pack)}
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
                                {/* Intensity indicator */}
                                {pack.avg_intensity !== null && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge className={`${getIntensityColor(pack.avg_intensity)} text-white`}>
                                            Avg: {pack.avg_intensity?.toFixed(1)}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            Range: {pack.min_intensity ?? '?'} - {pack.max_intensity ?? '?'}
                                        </span>
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        {pack.dare_count} dare{pack.dare_count !== 1 ? 's' : ''}
                                    </span>
                                    <Link to={`/dare-packs/${pack.id}/dares`}>
                                        <Button variant="outline" size="sm">
                                            Manage Dares
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {darePacks.length > 0 && (
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
