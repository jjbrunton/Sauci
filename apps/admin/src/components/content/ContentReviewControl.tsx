import { useEffect, useState } from 'react';
import type { ContentReviewStatus } from '@sauci/shared';
import { Archive, CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    CONTENT_STATUS_LABELS,
    type ReviewableContentTable,
    updateContentReviewStatus,
} from '@/services/contentReviews';

interface ContentReviewControlProps {
    table: ReviewableContentTable;
    entityId: string;
    entityLabel: string;
    status?: ContentReviewStatus | null;
    reason?: string | null;
    onChanged: () => void | Promise<void>;
    compact?: boolean;
}

const badgeClasses: Record<ContentReviewStatus, string> = {
    unreviewed: 'border-amber-500 text-amber-500',
    allowed: 'border-green-500 text-green-500',
    archived: 'border-slate-500 text-slate-400',
};

const statusIcons: Record<ContentReviewStatus, typeof ClipboardCheck> = {
    unreviewed: ClipboardCheck,
    allowed: CheckCircle2,
    archived: Archive,
};

export function ContentReviewControl({
    table,
    entityId,
    entityLabel,
    status,
    reason,
    onChanged,
    compact = false,
}: ContentReviewControlProps) {
    const { isSuperAdmin } = useAuth();
    const resolvedStatus = status ?? 'unreviewed';
    const StatusIcon = statusIcons[resolvedStatus];
    const [open, setOpen] = useState(false);
    const [nextStatus, setNextStatus] = useState<ContentReviewStatus>(resolvedStatus);
    const [nextReason, setNextReason] = useState(reason ?? '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) {
            setNextStatus(resolvedStatus);
            setNextReason(reason ?? '');
        }
    }, [open, reason, resolvedStatus]);

    const save = async () => {
        if (!nextReason.trim()) {
            toast.error('A review reason is required');
            return;
        }

        setSaving(true);
        try {
            await updateContentReviewStatus(table, entityId, nextStatus, nextReason);
            toast.success(`${entityLabel} marked ${CONTENT_STATUS_LABELS[nextStatus].toLowerCase()}`);
            setOpen(false);
            await onChanged();
        } catch (error) {
            toast.error('Failed to update catalogue status');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Badge
                variant="outline"
                className={`${badgeClasses[resolvedStatus]} ${compact ? 'text-[10px] px-1.5 py-0' : ''}`}
                title={reason || 'No review reason recorded'}
            >
                <StatusIcon className="mr-1 h-3 w-3" />
                {CONTENT_STATUS_LABELS[resolvedStatus]}
            </Badge>

            {isSuperAdmin && (
                <>
                    <Button
                        type="button"
                        variant="ghost"
                        size={compact ? 'sm' : 'default'}
                        className={compact ? 'h-7 px-2 text-xs' : undefined}
                        onClick={() => setOpen(true)}
                        aria-label={`Review catalogue status for ${entityLabel}`}
                    >
                        Review
                    </Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Review catalogue status</DialogTitle>
                                <DialogDescription>
                                    This records a reversible editorial decision for {entityLabel}.
                                    Current customer apps do not filter this status yet.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label htmlFor={`content-status-${entityId}`}>Status</Label>
                                    <Select
                                        value={nextStatus}
                                        onValueChange={(value) => {
                                            const selectedStatus = value as ContentReviewStatus;
                                            setNextStatus(selectedStatus);
                                            if (selectedStatus !== resolvedStatus) setNextReason('');
                                        }}
                                    >
                                        <SelectTrigger id={`content-status-${entityId}`}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unreviewed">Needs review</SelectItem>
                                            <SelectItem value="allowed">Allowed</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor={`content-reason-${entityId}`}>Reason</Label>
                                    <Textarea
                                        id={`content-reason-${entityId}`}
                                        value={nextReason}
                                        onChange={(event) => setNextReason(event.target.value)}
                                        placeholder="Explain why this content is allowed, archived, or needs another review"
                                        rows={4}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="button" onClick={save} disabled={saving || !nextReason.trim()}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save decision
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}
