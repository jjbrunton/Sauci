import { useState, useEffect } from 'react';
import { supabase } from '@/config';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('audit_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (error) throw error;
                setLogs(data || []);
            } catch (error) {
                console.error('Failed to load audit logs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

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
                            <TableHead className="w-32">Admin</TableHead>
                            <TableHead className="w-24">Action</TableHead>
                            <TableHead>Table</TableHead>
                            <TableHead>Changes</TableHead>
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
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium">{log.admin_username || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground capitalize">{log.admin_role?.replace('_', ' ')}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`${actionColors[log.action] || 'bg-gray-500'} text-white`}>
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {log.table_name}
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                        {log.action === 'DELETE' && log.old_values && (
                                            <code className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">
                                                Deleted: {JSON.stringify(log.old_values).substring(0, 100)}...
                                            </code>
                                        )}
                                        {log.action === 'INSERT' && log.new_values && (
                                            <code className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                                                Created: {JSON.stringify(log.new_values).substring(0, 100)}...
                                            </code>
                                        )}
                                        {log.action === 'UPDATE' && log.changed_fields && (
                                            <code className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                                Changed: {log.changed_fields.join(', ')}
                                            </code>
                                        )}
                                        {log.action === 'UPDATE' && !log.changed_fields && (
                                            <code className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                                Updated record
                                            </code>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
