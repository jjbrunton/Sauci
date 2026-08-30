import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminData } from '@/lib/adminApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PaginationControls } from '@/components/ui/pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Pencil, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { StrokeCanvas, type StrokeSegment } from '@/components/content/StrokeCanvas';

interface LiveDrawSession {
    couple_id: string;
    revision: number;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    couple_id: string | null;
}

export function LiveDrawSessionsPage() {
    const [sessions, setSessions] = useState<LiveDrawSession[]>([]);
    const [membersByCouple, setMembersByCouple] = useState<Record<string, Profile[]>>({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const [selectedCoupleId, setSelectedCoupleId] = useState<string | null>(null);
    const [strokes, setStrokes] = useState<StrokeSegment[]>([]);
    const [strokesLoading, setStrokesLoading] = useState(false);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await adminData
                .from<LiveDrawSession>('live_draw_sessions')
                .select('couple_id, revision, updated_by, created_at, updated_at', { count: 'exact' })
                .order('updated_at', { ascending: false })
                .range(from, to);
            if (error) throw error;

            const rows = data || [];
            setSessions(rows);
            setTotal(count || 0);

            const coupleIds = rows.map((row) => row.couple_id);
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
            console.error('Failed to load live draw sessions:', error);
            toast.error('Failed to load live draw sessions');
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (page > totalPages) setPage(totalPages);
    }, [page, pageSize, total]);

    const previewSession = async (coupleId: string) => {
        setSelectedCoupleId(coupleId);
        setStrokesLoading(true);
        setStrokes([]);
        try {
            const { data, error } = await adminData
                .from('live_draw_sessions')
                .select('strokes')
                .eq('couple_id', coupleId)
                .maybeSingle();
            if (error) throw error;
            setStrokes((data?.strokes as StrokeSegment[]) || []);
        } catch (error) {
            console.error('Failed to load drawing:', error);
            toast.error('Failed to load drawing');
        } finally {
            setStrokesLoading(false);
        }
    };

    const renderMembers = (coupleId: string) => {
        const members = membersByCouple[coupleId] || [];
        if (members.length === 0) return <span className="text-muted-foreground text-sm">Unknown couple</span>;
        return (
            <div className="flex flex-col gap-1">
                {members.map((member) => (
                    <Link key={member.id} to={`/users/${member.id}`} className="text-primary hover:underline text-sm">
                        {member.name || member.email || member.id}
                    </Link>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Pencil className="h-8 w-8 text-primary" />
                    Live Draw Sessions
                </h1>
                <p className="text-muted-foreground">
                    Recent live-draw activity across couples, most recently updated first
                </p>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Couple</TableHead>
                            <TableHead>Revision</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                    <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                </TableCell>
                            </TableRow>
                        ) : sessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No live draw sessions yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sessions.map((session) => (
                                <TableRow key={session.couple_id}>
                                    <TableCell>{renderMembers(session.couple_id)}</TableCell>
                                    <TableCell><Badge variant="outline">{session.revision}</Badge></TableCell>
                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                        {format(new Date(session.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                        {format(new Date(session.updated_at), 'MMM d, yyyy HH:mm')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => previewSession(session.couple_id)}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            Preview
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
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

            {selectedCoupleId && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Drawing Preview</CardTitle>
                        <CardDescription>Read-only snapshot of the couple's shared canvas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {strokesLoading ? (
                            <Skeleton className="h-64 w-full" />
                        ) : strokes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Pencil className="h-12 w-12 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">No strokes to show</p>
                            </div>
                        ) : (
                            <StrokeCanvas strokes={strokes} />
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
