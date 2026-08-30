import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminData } from '@/lib/adminApi';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords, Eye, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SENT_DARE_STATUS_LABELS, SENT_DARE_STATUSES, isSentDareOverdue, type SentDareStatus } from '@/lib/sentDares';

interface Profile {
    id: string;
    name: string | null;
    email: string | null;
}

interface SentDare {
    id: string;
    couple_id: string;
    dare_text_snapshot: string;
    custom_dare_text: string | null;
    dare_intensity_snapshot: number;
    sender_id: string;
    recipient_id: string;
    status: string;
    sent_at: string;
    expires_at: string | null;
}

interface DareMessage {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
    read_at: string | null;
}

const STATUS_FILTER_OPTIONS: Array<'all' | SentDareStatus> = ['all', ...SENT_DARE_STATUSES];

export function SentDaresPage() {
    const [dares, setDares] = useState<SentDare[]>([]);
    const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | SentDareStatus>('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const [selectedDare, setSelectedDare] = useState<SentDare | null>(null);
    const [messages, setMessages] = useState<DareMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);

    const fetchDares = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = adminData
                .from<SentDare>('sent_dares')
                .select('id, couple_id, dare_text_snapshot, custom_dare_text, dare_intensity_snapshot, sender_id, recipient_id, status, sent_at, expires_at', { count: 'exact' })
                .order('sent_at', { ascending: false })
                .range(from, to);

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            const rows = data || [];
            setDares(rows);
            setTotal(count || 0);

            const userIds = [...new Set(rows.flatMap((row) => [row.sender_id, row.recipient_id]))];
            if (userIds.length > 0) {
                const { data: profiles } = await adminData
                    .from<Profile>('profiles')
                    .select('id, name, email')
                    .in('id', userIds);
                setProfilesById((profiles || []).reduce((acc: Record<string, Profile>, profile) => {
                    acc[profile.id] = profile;
                    return acc;
                }, {}));
            } else {
                setProfilesById({});
            }
        } catch (error) {
            console.error('Failed to load sent dares:', error);
            toast.error('Failed to load sent dares');
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, statusFilter]);

    useEffect(() => { fetchDares(); }, [fetchDares]);

    useEffect(() => { setPage(1); }, [statusFilter]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (page > totalPages) setPage(totalPages);
    }, [page, pageSize, total]);

    const renderUserLink = (userId: string) => {
        const profile = profilesById[userId];
        return (
            <Link to={`/users/${userId}`} className="text-primary hover:underline">
                {profile?.name || profile?.email || 'Unknown user'}
            </Link>
        );
    };

    const openDetail = async (dare: SentDare) => {
        setSelectedDare(dare);
        setMessagesLoading(true);
        setMessages([]);
        try {
            const { data, error } = await adminData
                .from<DareMessage>('dare_messages')
                .select('id, sender_id, content, created_at, read_at')
                .eq('sent_dare_id', dare.id)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Failed to load dare messages:', error);
            toast.error('Failed to load dare messages');
        } finally {
            setMessagesLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Swords className="h-8 w-8 text-primary" />
                        Sent Dares
                    </h1>
                    <p className="text-muted-foreground">
                        Review the dares loop between couples for moderation and support
                    </p>
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | SentDareStatus)}>
                    <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_FILTER_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status} className="capitalize">
                                {status === 'all' ? 'All statuses' : SENT_DARE_STATUS_LABELS[status].label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Dare</TableHead>
                            <TableHead>Sender</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sent</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                </TableCell>
                            </TableRow>
                        ) : dares.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No sent dares found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            dares.map((dare) => {
                                const statusInfo = SENT_DARE_STATUS_LABELS[dare.status as SentDareStatus];
                                const overdue = isSentDareOverdue(dare.status, dare.expires_at);
                                return (
                                    <TableRow key={dare.id}>
                                        <TableCell className="max-w-[280px]">
                                            <span className="line-clamp-2 block">{dare.custom_dare_text || dare.dare_text_snapshot}</span>
                                        </TableCell>
                                        <TableCell>{renderUserLink(dare.sender_id)}</TableCell>
                                        <TableCell>{renderUserLink(dare.recipient_id)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={statusInfo?.variant ?? 'secondary'} className="capitalize">{statusInfo?.label ?? dare.status}</Badge>
                                                {overdue && <Badge variant="destructive">Overdue</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {format(new Date(dare.sent_at), 'MMM d, yyyy HH:mm')}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {dare.expires_at ? format(new Date(dare.expires_at), 'MMM d, yyyy HH:mm') : 'No expiry'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openDetail(dare)}>
                                                <Eye className="h-4 w-4 mr-2" />
                                                Messages
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>

            {total > 0 && (
                <PaginationControls
                    page={page}
                    pageSize={pageSize}
                    totalCount={total}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPage(1); setPageSize(size); }}
                />
            )}

            <Dialog open={!!selectedDare} onOpenChange={(open) => !open && setSelectedDare(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Dare Messages
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDare && (selectedDare.custom_dare_text || selectedDare.dare_text_snapshot)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-[120px] max-h-[400px] overflow-y-auto space-y-3 bg-muted/30 rounded-md p-4">
                        {messagesLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : messages.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No messages for this dare</p>
                        ) : (
                            messages.map((message) => (
                                <div key={message.id} className="bg-background border rounded p-3 text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium">
                                            {selectedDare && (message.sender_id === selectedDare.sender_id ? 'Sender' : 'Recipient')}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(message.created_at), 'MMM d, yyyy HH:mm')}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
