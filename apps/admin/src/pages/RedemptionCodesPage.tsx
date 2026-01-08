import { useState, useEffect, useCallback } from 'react';

import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';

import { Switch } from '@/components/ui/switch';
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Ticket, Trash2, Plus, Copy, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RedemptionCode {
    id: string;
    code: string;
    description: string | null;
    max_uses: number;
    current_uses: number;
    expires_at: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

interface CodeRedemption {
    id: string;
    user_id: string;
    redeemed_at: string;
    profile?: {
        name: string | null;
        email: string | null;
    };
}

function generateCode(length: number = 8): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, I, 1
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function RedemptionCodesPage() {
    const [codes, setCodes] = useState<RedemptionCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalCount, setTotalCount] = useState(0);


    // Add Code State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        max_uses: 1,
        expires_at: '',
    });

    // View Redemptions State
    const [viewingCode, setViewingCode] = useState<RedemptionCode | null>(null);
    const [redemptions, setRedemptions] = useState<CodeRedemption[]>([]);
    const [loadingRedemptions, setLoadingRedemptions] = useState(false);
    const [redemptionsPage, setRedemptionsPage] = useState(1);
    const [redemptionsPageSize, setRedemptionsPageSize] = useState(10);
    const [redemptionsTotal, setRedemptionsTotal] = useState(0);




    const fetchCodes = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            const trimmedSearch = search.trim();

            let query = supabase
                .from('redemption_codes')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (trimmedSearch) {
                query = query.or(`code.ilike.%${trimmedSearch}%,description.ilike.%${trimmedSearch}%`);
            }

            const { data, error, count } = await query.range(from, to);

            if (error) throw error;
            setCodes(data || []);
            setTotalCount(count || 0);
        } catch (error: any) {
            console.error('Failed to load codes:', error);
            toast.error("Failed to load redemption codes");
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, search]);


    const fetchRedemptions = useCallback(async (codeId: string) => {
        setLoadingRedemptions(true);
        try {
            const from = (redemptionsPage - 1) * redemptionsPageSize;
            const to = from + redemptionsPageSize - 1;

            const { data: redemptionData, error: redemptionError, count } = await supabase
                .from('code_redemptions')
                .select('id, user_id, redeemed_at', { count: 'exact' })
                .eq('code_id', codeId)
                .order('redeemed_at', { ascending: false })
                .range(from, to);

            if (redemptionError) throw redemptionError;

            setRedemptionsTotal(count || 0);

            if (redemptionData && redemptionData.length > 0) {
                const userIds = redemptionData.map(r => r.user_id);
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id, name, email')
                    .in('id', userIds);

                const joined = redemptionData.map(r => ({
                    ...r,
                    profile: profileData?.find(p => p.id === r.user_id)
                }));
                setRedemptions(joined);
            } else {
                setRedemptions([]);
            }
        } catch (error: any) {
            console.error('Failed to load redemptions:', error);
            toast.error("Failed to load redemptions");
        } finally {
            setLoadingRedemptions(false);
        }
    }, [redemptionsPage, redemptionsPageSize]);

    useEffect(() => {
        fetchCodes();
    }, [fetchCodes]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, pageSize, totalCount]);

    useEffect(() => {
        if (viewingCode) {
            fetchRedemptions(viewingCode.id);
        }
    }, [viewingCode, fetchRedemptions]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(redemptionsTotal / redemptionsPageSize));
        if (redemptionsPage > totalPages) {
            setRedemptionsPage(totalPages);
        }
    }, [redemptionsPage, redemptionsPageSize, redemptionsTotal]);


    const handleAddCode = async () => {
        if (!formData.code.trim()) {
            toast.error("Please enter a code");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await auditedSupabase.insert('redemption_codes', {
                code: formData.code.toUpperCase().trim(),
                description: formData.description.trim() || null,
                max_uses: formData.max_uses,
                current_uses: 0,
                expires_at: formData.expires_at || null,
                is_active: true,
            });

            if (error) throw error;

            toast.success("Redemption code created");
            setIsAddDialogOpen(false);
            resetForm();
            fetchCodes();
        } catch (error: any) {
            console.error('Failed to create code:', error);
            if (error.message?.includes('duplicate') || error.code === '23505') {
                toast.error("This code already exists");
            } else {
                toast.error(error.message || "Failed to create code");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (code: RedemptionCode) => {
        try {
            const { error } = await auditedSupabase.update('redemption_codes', code.id, {
                is_active: !code.is_active,
            });

            if (error) throw error;

            toast.success(code.is_active ? "Code deactivated" : "Code activated");
            fetchCodes();
        } catch (error: any) {
            toast.error("Failed to update code");
        }
    };

    const handleDeleteCode = async (code: RedemptionCode) => {
        if (!confirm(`Are you sure you want to delete the code "${code.code}"? This cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await auditedSupabase.delete('redemption_codes', code.id);

            if (error) throw error;

            toast.success("Code deleted");
            fetchCodes();
        } catch (error: any) {
            toast.error("Failed to delete code");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const resetForm = () => {
        setFormData({
            code: '',
            description: '',
            max_uses: 1,
            expires_at: '',
        });
    };

    const handleOpenAddDialog = () => {
        resetForm();
        setFormData(prev => ({ ...prev, code: generateCode() }));
        setIsAddDialogOpen(true);
    };

    const handleViewRedemptions = (code: RedemptionCode) => {
        setViewingCode(code);
        setRedemptionsPage(1);
    };


    const filteredCodes = codes;


    const getStatusBadge = (code: RedemptionCode) => {
        if (!code.is_active) {
            return <Badge variant="secondary">Inactive</Badge>;
        }
        if (code.expires_at && new Date(code.expires_at) < new Date()) {
            return <Badge variant="destructive">Expired</Badge>;
        }
        if (code.current_uses >= code.max_uses) {
            return <Badge variant="outline">Exhausted</Badge>;
        }
        return <Badge variant="default">Active</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Redemption Codes</h1>
                    <p className="text-muted-foreground">
                        Generate and manage codes that grant premium access
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search codes..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleOpenAddDialog}>
                                <Plus className="h-4 w-4 mr-2" />
                                Generate Code
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Generate Redemption Code</DialogTitle>
                                <DialogDescription>
                                    Create a new code that users can redeem for premium access.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Code</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={formData.code}
                                            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                            placeholder="e.g., PREMIUM2024"
                                            className="font-mono"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setFormData(prev => ({ ...prev, code: generateCode() }))}
                                            title="Generate random code"
                                        >
                                            <Ticket className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description (optional)</Label>
                                    <Input
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="e.g., Early adopter reward"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Max Uses</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={formData.max_uses}
                                        onChange={(e) => setFormData(prev => ({ ...prev, max_uses: parseInt(e.target.value) || 1 }))}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        How many times this code can be redeemed
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Expires At (optional)</Label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.expires_at}
                                        onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddCode} disabled={!formData.code.trim() || isSubmitting}>
                                    {isSubmitting ? 'Creating...' : 'Create Code'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Usage</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-[150px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                </TableCell>
                            </TableRow>
                        ) : filteredCodes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    {search ? 'No codes match your search.' : 'No redemption codes yet. Generate your first one!'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCodes.map((code) => (
                                <TableRow key={code.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <code className="font-mono font-medium text-sm bg-muted px-2 py-1 rounded">
                                                {code.code}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => copyToClipboard(code.code)}
                                                title="Copy code"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {code.description || '—'}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium">{code.current_uses}</span>
                                        <span className="text-muted-foreground"> / {code.max_uses}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {code.expires_at
                                            ? format(new Date(code.expires_at), 'MMM d, yyyy HH:mm')
                                            : 'Never'}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(code)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {format(new Date(code.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleViewRedemptions(code)}
                                                title="View redemptions"
                                            >
                                                <Users className="h-4 w-4" />
                                            </Button>
                                            <Switch
                                                checked={code.is_active}
                                                onCheckedChange={() => handleToggleActive(code)}
                                                title={code.is_active ? "Deactivate" : "Activate"}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDeleteCode(code)}
                                                title="Delete code"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {filteredCodes.length > 0 && (
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


            {/* View Redemptions Dialog */}
            <Dialog open={!!viewingCode} onOpenChange={(open) => !open && setViewingCode(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            Redemptions for <code className="font-mono bg-muted px-2 py-0.5 rounded">{viewingCode?.code}</code>
                        </DialogTitle>
                        <DialogDescription>
                            {viewingCode?.current_uses || 0} of {viewingCode?.max_uses} uses
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[300px] overflow-y-auto">
                        {loadingRedemptions ? (
                            <div className="flex justify-center py-8">
                                <Skeleton className="h-6 w-32" />
                            </div>
                        ) : redemptions.length === 0 ? (
                            <p className="text-center py-8 text-muted-foreground">
                                No one has redeemed this code yet.
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Redeemed At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {redemptions.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">{r.profile?.name || 'Unknown'}</div>
                                                    <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {format(new Date(r.redeemed_at), 'MMM d, yyyy HH:mm')}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {redemptionsTotal > 0 && (
                        <PaginationControls
                            page={redemptionsPage}
                            pageSize={redemptionsPageSize}
                            totalCount={redemptionsTotal}
                            onPageChange={setRedemptionsPage}
                            onPageSizeChange={(size) => {
                                setRedemptionsPage(1);
                                setRedemptionsPageSize(size);
                            }}
                        />
                    )}
                    <DialogFooter>

                        <Button variant="outline" onClick={() => setViewingCode(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
