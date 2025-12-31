import { useState, useEffect } from 'react';
import { supabase } from '@/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Bug, Lightbulb, MessageSquare, HelpCircle, ExternalLink, Smartphone, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

type FeedbackType = 'bug' | 'feature_request' | 'general' | 'question';
type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';

interface Feedback {
    id: string;
    user_id: string;
    type: FeedbackType;
    title: string;
    description: string;
    screenshot_url: string | null;
    device_info: Record<string, unknown>;
    status: FeedbackStatus;
    admin_notes: string | null;
    question_id: string | null;
    created_at: string;
    updated_at: string;
    profile?: {
        id: string;
        name: string | null;
        email: string | null;
    };
    question?: {
        id: string;
        text: string;
        pack?: {
            name: string;
        };
    };
}

const feedbackTypeConfig: Record<FeedbackType, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    bug: { label: 'Bug', icon: <Bug className="h-3 w-3" />, variant: 'destructive' },
    feature_request: { label: 'Feature', icon: <Lightbulb className="h-3 w-3" />, variant: 'default' },
    general: { label: 'General', icon: <MessageSquare className="h-3 w-3" />, variant: 'secondary' },
    question: { label: 'Question', icon: <HelpCircle className="h-3 w-3" />, variant: 'outline' },
};

const statusConfig: Record<FeedbackStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    new: { label: 'New', variant: 'destructive' },
    reviewed: { label: 'Reviewed', variant: 'secondary' },
    in_progress: { label: 'In Progress', variant: 'default' },
    resolved: { label: 'Resolved', variant: 'outline' },
    closed: { label: 'Closed', variant: 'outline' },
};

export function FeedbackPage() {
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Detail Dialog State
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editStatus, setEditStatus] = useState<FeedbackStatus>('new');
    const [editNotes, setEditNotes] = useState('');

    useEffect(() => {
        fetchFeedback();
    }, []);

    const fetchFeedback = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('feedback')
                .select(`
                    *,
                    profile:profiles!feedback_user_id_fkey(id, name, email),
                    question:questions!feedback_question_id_fkey(id, text, pack:question_packs(name))
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setFeedback(data || []);
        } catch (error: any) {
            console.error('Failed to load feedback:', error);
            toast.error("Failed to load feedback");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDetail = (item: Feedback) => {
        setSelectedFeedback(item);
        setEditStatus(item.status);
        setEditNotes(item.admin_notes || '');
    };

    const handleUpdateFeedback = async () => {
        if (!selectedFeedback) return;

        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from('feedback')
                .update({
                    status: editStatus,
                    admin_notes: editNotes.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedFeedback.id);

            if (error) throw error;

            toast.success("Feedback updated");
            setSelectedFeedback(null);
            fetchFeedback();
        } catch (error: any) {
            console.error('Failed to update feedback:', error);
            toast.error("Failed to update feedback");
        } finally {
            setIsUpdating(false);
        }
    };

    const filteredFeedback = feedback.filter(item => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        if (!search) return true;

        const query = search.toLowerCase();
        return (
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.profile?.name?.toLowerCase().includes(query) ||
            item.profile?.email?.toLowerCase().includes(query)
        );
    });

    const getTypeBadge = (type: FeedbackType) => {
        const config = feedbackTypeConfig[type];
        return (
            <Badge variant={config.variant} className="gap-1">
                {config.icon}
                {config.label}
            </Badge>
        );
    };

    const getStatusBadge = (status: FeedbackStatus) => {
        const config = statusConfig[status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const formatDeviceInfo = (info: Record<string, unknown>) => {
        if (!info || Object.keys(info).length === 0) return null;

        const lines: string[] = [];
        if (info.platform) lines.push(`Platform: ${info.platform}`);
        if (info.osVersion) lines.push(`OS Version: ${info.osVersion}`);
        if (info.appVersion) lines.push(`App Version: ${info.appVersion}`);
        if (info.deviceModel) lines.push(`Device: ${info.deviceModel}`);

        return lines.length > 0 ? lines.join('\n') : JSON.stringify(info, null, 2);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Feedback</h1>
                    <p className="text-muted-foreground">
                        Review and respond to user feedback submissions
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search feedback..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="bug">Bug</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                </TableCell>
                            </TableRow>
                        ) : filteredFeedback.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    {search || typeFilter !== 'all' || statusFilter !== 'all'
                                        ? 'No feedback matches your filters.'
                                        : 'No feedback submissions yet.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredFeedback.map((item) => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenDetail(item)}>
                                    <TableCell>{getTypeBadge(item.type)}</TableCell>
                                    <TableCell>
                                        <div className="max-w-[300px]">
                                            <div className="font-medium truncate">{item.title}</div>
                                            <div className="text-sm text-muted-foreground truncate">
                                                {item.description.slice(0, 80)}
                                                {item.description.length > 80 && '...'}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div className="font-medium">{item.profile?.name || 'Unknown'}</div>
                                            <div className="text-muted-foreground">{item.profile?.email}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {format(new Date(item.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetail(item); }}>
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedFeedback && getTypeBadge(selectedFeedback.type)}
                            <span className="truncate">{selectedFeedback?.title}</span>
                        </DialogTitle>
                        <DialogDescription>
                            Submitted {selectedFeedback && format(new Date(selectedFeedback.created_at), 'MMMM d, yyyy \'at\' h:mm a')}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedFeedback && (
                        <div className="space-y-6">
                            {/* User Info */}
                            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div className="flex-1">
                                    <div className="font-medium">{selectedFeedback.profile?.name || 'Unknown User'}</div>
                                    <div className="text-sm text-muted-foreground">{selectedFeedback.profile?.email}</div>
                                    {selectedFeedback.profile?.id && (
                                        <Link
                                            to={`/users/${selectedFeedback.profile.id}`}
                                            className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            View user profile <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <Label className="text-sm font-medium">Description</Label>
                                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedFeedback.description}</p>
                            </div>

                            {/* Related Question */}
                            {selectedFeedback.question && (
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <Label className="text-sm font-medium">Related Question</Label>
                                    <p className="mt-1 text-sm">{selectedFeedback.question.text}</p>
                                    {selectedFeedback.question.pack && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            From pack: {selectedFeedback.question.pack.name}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Screenshot */}
                            {selectedFeedback.screenshot_url && (
                                <div>
                                    <Label className="text-sm font-medium">Screenshot</Label>
                                    <a
                                        href={selectedFeedback.screenshot_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1 block"
                                    >
                                        <img
                                            src={selectedFeedback.screenshot_url}
                                            alt="Screenshot"
                                            className="max-w-full max-h-[200px] rounded border object-contain"
                                        />
                                    </a>
                                </div>
                            )}

                            {/* Device Info */}
                            {selectedFeedback.device_info && Object.keys(selectedFeedback.device_info).length > 0 && (
                                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                                    <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                        <Label className="text-sm font-medium">Device Info</Label>
                                        <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                                            {formatDeviceInfo(selectedFeedback.device_info)}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Status Update */}
                            <div className="space-y-4 pt-4 border-t">
                                <div className="grid gap-2">
                                    <Label>Status</Label>
                                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as FeedbackStatus)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">New</SelectItem>
                                            <SelectItem value="reviewed">Reviewed</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="resolved">Resolved</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Admin Notes</Label>
                                    <Textarea
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        placeholder="Add internal notes about this feedback..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateFeedback} disabled={isUpdating}>
                            {isUpdating ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
