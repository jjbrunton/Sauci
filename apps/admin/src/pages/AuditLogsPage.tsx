import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config';
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
import { format } from 'date-fns';

interface AuditLog {
    id: string;
    admin_user_id: string;
    admin_username: string | null;
    admin_role: string;
    action: string;
    table_name: string;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    changed_fields: string[] | null;
    created_at: string;
}

const actionColors: Record<string, string> = {
    INSERT: 'bg-green-500',
    UPDATE: 'bg-blue-500',
    DELETE: 'bg-red-500',
};

export function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            setLogs(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, pageSize, totalCount]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                <p className="text-muted-foreground">
                    Track all administrative actions and data changes
                </p>
            </div>

            {/* Logs Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-40">Time</TableHead>
                            <TableHead className="hidden md:table-cell w-32">Admin</TableHead>
                            <TableHead className="hidden md:table-cell w-24">Action</TableHead>
                            <TableHead className="hidden lg:table-cell">Table</TableHead>
                            <TableHead className="hidden lg:table-cell">Changes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No audit logs found
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => {
                                const actionBadge = (
                                    <Badge className={`${actionColors[log.action] || 'bg-gray-500'} text-white`}>
                                        {log.action}
                                    </Badge>
                                );

                                const changesContent = log.action === 'DELETE' && log.old_values ? (
                                    <code className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">
                                        Deleted: {JSON.stringify(log.old_values).substring(0, 100)}...
                                    </code>
                                ) : log.action === 'INSERT' && log.new_values ? (
                                    <code className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                                        Created: {JSON.stringify(log.new_values).substring(0, 100)}...
                                    </code>
                                ) : log.action === 'UPDATE' && log.changed_fields ? (
                                    <code className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                        Changed: {log.changed_fields.join(', ')}
                                    </code>
                                ) : log.action === 'UPDATE' ? (
                                    <code className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                        Updated record
                                    </code>
                                ) : null;

                                return (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                            <div className="mt-2 space-y-1 text-xs text-muted-foreground md:hidden">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-foreground">{log.admin_username || 'Unknown'}</span>
                                                    <span className="capitalize">{log.admin_role?.replace('_', ' ')}</span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {actionBadge}
                                                    <span className="font-mono">{log.table_name}</span>
                                                </div>
                                                {changesContent && <div>{changesContent}</div>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <div className="text-sm font-medium">{log.admin_username || 'Unknown'}</div>
                                            <div className="text-xs text-muted-foreground capitalize">{log.admin_role?.replace('_', ' ')}</div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {actionBadge}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell font-mono text-sm">
                                            {log.table_name}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell max-w-md">
                                            {changesContent}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {logs.length > 0 && (
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
