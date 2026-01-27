import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Zap, Loader2, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { IconPreview } from '@/components/ui/icon-picker';

// =============================================================================
// Types
// =============================================================================

interface DarePack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
}

interface Dare {
    id: string;
    pack_id: string;
    text: string;
    intensity: number;
    suggested_duration_hours: number | null;
    created_at: string | null;
}

// Duration options for dares
const DURATION_OPTIONS = [
    { value: '', label: 'No suggestion' },
    { value: '1', label: '1 hour' },
    { value: '6', label: '6 hours' },
    { value: '12', label: '12 hours' },
    { value: '24', label: '24 hours' },
    { value: '72', label: '3 days' },
    { value: '168', label: '1 week' },
];

// Format duration for display
const formatDuration = (hours: number | null): string => {
    if (hours === null) return '—';
    if (hours < 24) return `${hours}h`;
    if (hours < 168) return `${Math.round(hours / 24)}d`;
    return `${Math.round(hours / 168)}w`;
};

// =============================================================================
// Component
// =============================================================================

export function DaresPage() {
    const { packId } = useParams<{ packId: string }>();
    const [pack, setPack] = useState<DarePack | null>(null);
    const [dares, setDares] = useState<Dare[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDare, setEditingDare] = useState<Dare | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Form state
    const [formData, setFormData] = useState<{
        text: string;
        suggested_duration_hours: string;
    }>({
        text: '',
        suggested_duration_hours: '',
    });

    const fetchData = useCallback(async () => {
        if (!packId) return;

        setLoading(true);
        try {
            // Fetch pack info
            const { data: packData } = await supabase
                .from('dare_packs')
                .select('id, name, description, icon')
                .eq('id', packId)
                .single();

            setPack(packData);

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            // Fetch dares
            const { data: dareData, error, count } = await supabase
                .from('dares')
                .select('*', { count: 'exact' })
                .eq('pack_id', packId)
                .order('created_at', { ascending: true })
                .range(from, to);

            if (error) throw error;
            setTotalCount(count || 0);
            setDares(dareData || []);
        } catch (error) {
            toast.error('Failed to load dares');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [packId, page, pageSize]);

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
    }, [packId]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [page, pageSize]);

    const openCreateDialog = () => {
        setEditingDare(null);
        setFormData({ text: '', suggested_duration_hours: '' });
        setDialogOpen(true);
    };

    const openEditDialog = (dare: Dare) => {
        setEditingDare(dare);
        setFormData({
            text: dare.text,
            suggested_duration_hours: dare.suggested_duration_hours?.toString() || '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.text.trim()) {
            toast.error('Dare text is required');
            return;
        }

        setSaving(true);
        try {
            const dareData = {
                text: formData.text,
                suggested_duration_hours: formData.suggested_duration_hours
                    ? parseInt(formData.suggested_duration_hours, 10)
                    : null,
            };

            if (editingDare) {
                const { error } = await auditedSupabase.update('dares', editingDare.id, dareData);
                if (error) throw error;
                toast.success('Dare updated');
            } else {
                const { error } = await auditedSupabase.insert('dares', {
                    ...dareData,
                    pack_id: packId,
                });
                if (error) throw error;
                toast.success('Dare created');
            }

            setDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to save dare');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (dare: Dare) => {
        if (!confirm('Delete this dare? This cannot be undone.')) {
            return;
        }

        try {
            const { error } = await auditedSupabase.delete('dares', dare.id);
            if (error) throw error;
            toast.success('Dare deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete dare');
            console.error(error);
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
        if (selectedIds.size === dares.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(dares.map(d => d.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        if (!confirm(`Delete ${count} dare${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
            return;
        }

        setBulkDeleting(true);
        try {
            await Promise.all(
                Array.from(selectedIds).map(id => auditedSupabase.delete('dares', id))
            );
            toast.success(`${count} dare${count !== 1 ? 's' : ''} deleted`);
            setSelectedIds(new Set());
            fetchData();
        } catch (error) {
            toast.error('Failed to delete dares');
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
                                <span className="text-3xl">
                                    <IconPreview value={pack.icon} fallback="flame-outline" className="text-3xl" />
                                </span>
                                {pack.name}
                            </>
                        )}
                    </h1>
                    <p className="text-muted-foreground">
                        {totalCount} dare{totalCount !== 1 ? 's' : ''} in this pack
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Dare
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {editingDare ? 'Edit Dare' : 'Add Dare'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingDare
                                    ? 'Update the dare details below.'
                                    : 'Add a new dare to this pack.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="text">Dare Text</Label>
                                <Textarea
                                    id="text"
                                    value={formData.text}
                                    onChange={(e) => setFormData(d => ({ ...d, text: e.target.value }))}
                                    placeholder="e.g., Give your partner a 5-minute massage..."
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Suggested Duration</Label>
                                <Select
                                    value={formData.suggested_duration_hours}
                                    onValueChange={(value) => setFormData(d => ({ ...d, suggested_duration_hours: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a duration" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DURATION_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    This is a suggestion shown to users when sending the dare. They can choose a different timeframe.
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

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                            {selectedIds.size} dare{selectedIds.size !== 1 ? 's' : ''} selected
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
                                Delete {selectedIds.size} Dare{selectedIds.size !== 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Dares Table */}
            {dares.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                    <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No dares yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Add dares to this pack for couples to challenge each other
                    </p>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Dare
                    </Button>
                </Card>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={selectedIds.size === dares.length && dares.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Dare</TableHead>
                                <TableHead className="w-24">Duration</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dares.map((dare, index) => (
                                <TableRow
                                    key={dare.id}
                                    className={selectedIds.has(dare.id) ? 'bg-muted/50' : ''}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(dare.id)}
                                            onCheckedChange={() => toggleSelection(dare.id)}
                                            aria-label={`Select dare ${index + 1}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium text-muted-foreground">
                                        {(page - 1) * pageSize + index + 1}
                                    </TableCell>
                                    <TableCell>
                                        <span className="line-clamp-2">{dare.text}</span>
                                    </TableCell>
                                    <TableCell>
                                        {dare.suggested_duration_hours ? (
                                            <Badge variant="outline" className="text-xs">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {formatDuration(dare.suggested_duration_hours)}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditDialog(dare)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(dare)}
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
            )}

            {dares.length > 0 && (
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
