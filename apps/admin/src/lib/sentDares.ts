// sent_dares status lifecycle mirrors the check constraint added in
// apps/api/drizzle/0013_dares_loop.sql: pending -> active -> submitted -> completed,
// with expired/declined/cancelled as terminal side branches.

export const SENT_DARE_STATUSES = [
    'pending', 'active', 'submitted', 'completed', 'expired', 'declined', 'cancelled',
] as const;

export type SentDareStatus = typeof SENT_DARE_STATUSES[number];

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const SENT_DARE_STATUS_LABELS: Record<SentDareStatus, { label: string; variant: BadgeVariant }> = {
    pending: { label: 'Pending', variant: 'secondary' },
    active: { label: 'Active', variant: 'default' },
    submitted: { label: 'Submitted', variant: 'default' },
    completed: { label: 'Completed', variant: 'outline' },
    expired: { label: 'Expired', variant: 'destructive' },
    declined: { label: 'Declined', variant: 'destructive' },
    cancelled: { label: 'Cancelled', variant: 'outline' },
};

const OPEN_STATUSES: ReadonlySet<SentDareStatus> = new Set(['pending', 'active', 'submitted']);

/**
 * A dare is overdue when it is still in an open state but its expiry has
 * already passed. The worker sweeps these to `expired` asynchronously, so the
 * admin view can lag the true status briefly; this flags that gap for support.
 */
export function isSentDareOverdue(
    status: string,
    expiresAt: string | null,
    now: Date = new Date(),
): boolean {
    if (!expiresAt) return false;
    if (!OPEN_STATUSES.has(status as SentDareStatus)) return false;
    return new Date(expiresAt).getTime() < now.getTime();
}
