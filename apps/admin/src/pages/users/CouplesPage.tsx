import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminData } from '@/lib/adminApi';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Heart, Search, Users, Hourglass } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildCoupleSearchFilter, coupleStatusFromMemberCount } from '@/lib/couples';

interface Couple {
    id: string;
    invite_code: string;
    created_at: string;
}

interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    couple_id: string | null;
}

export function CouplesPage() {
    const [couples, setCouples] = useState<Couple[]>([]);
    const [membersByCouple, setMembersByCouple] = useState<Record<string, Profile[]>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const fetchCouples = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = adminData
                .from<Couple>('couples')
                .select('id, invite_code, created_at', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            const filter = buildCoupleSearchFilter(search);
            if (filter) {
                query = filter.op === 'eq' ? query.eq(filter.column, filter.value) : query.ilike(filter.column, filter.value);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            const rows = data || [];
            setCouples(rows);
            setTotal(count || 0);

            const coupleIds = rows.map((row) => row.id);
            if (coupleIds.length > 0) {
                const { data: profiles } = await adminData
                    .from<Profile>('profiles')
                    .select('id, name, email, couple_id')
                    .in('couple_id', coupleIds);
                const grouped: Record<string, Profile[]> = {};
                (profiles || []).forEach((profile) => {
                    if (!profile.couple_id) return;
                    (grouped[profile.couple_id] ??= []).push(profile);
                });
                setMembersByCouple(grouped);
            } else {
                setMembersByCouple({});
            }
        } catch (error) {
            console.error('Failed to load couples:', error);
            toast.error('Failed to load couples');
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, search]);

    useEffect(() => { fetchCouples(); }, [fetchCouples]);
    useEffect(() => { setPage(1); }, [search]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (page > totalPages) setPage(totalPages);
    }, [page, pageSize, total]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Heart className="h-8 w-8 text-primary" />
                        Couples
                    </h1>
                    <p className="text-muted-foreground">
                        Look up an invite funnel by invite code or couple id
                    </p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search invite code or couple id..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invite Code</TableHead>
                            <TableHead>Members</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8">
                                    <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                </TableCell>
                            </TableRow>
                        ) : couples.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    {search ? 'No couples found matching your search.' : 'No couples yet.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            couples.map((couple) => {
                                const members = membersByCouple[couple.id] || [];
                                const status = coupleStatusFromMemberCount(members.length);
                                return (
                                    <TableRow key={couple.id}>
                                        <TableCell className="font-mono">{couple.invite_code}</TableCell>
                                        <TableCell>
                                            {members.length === 0 ? (
                                                <span className="text-muted-foreground text-sm">No members</span>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    {members.map((member) => (
                                                        <Link key={member.id} to={`/users/${member.id}`} className="text-primary hover:underline text-sm">
                                                            {member.name || member.email || member.id}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {status === 'paired' ? (
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">
                                                    <Users className="h-3 w-3 mr-1" />
                                                    Paired
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                                                    <Hourglass className="h-3 w-3 mr-1" />
                                                    Pending
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {format(new Date(couple.created_at), 'MMM d, yyyy')}
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
        </div>
    );
}
