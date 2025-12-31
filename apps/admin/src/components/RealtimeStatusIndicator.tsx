import type { SubscriptionStatus } from '@/hooks/useRealtimeSubscription';

interface RealtimeStatusIndicatorProps {
    status: SubscriptionStatus;
    showLabel?: boolean;
}

const statusConfig: Record<SubscriptionStatus, { color: string; pulseColor: string; label: string }> = {
    SUBSCRIBED: { color: 'bg-green-500', pulseColor: 'bg-green-400', label: 'Live' },
    SUBSCRIBING: { color: 'bg-yellow-500', pulseColor: 'bg-yellow-400', label: 'Connecting...' },
    CHANNEL_ERROR: { color: 'bg-red-500', pulseColor: 'bg-red-400', label: 'Error' },
    TIMED_OUT: { color: 'bg-orange-500', pulseColor: 'bg-orange-400', label: 'Timed out' },
    CLOSED: { color: 'bg-gray-500', pulseColor: 'bg-gray-400', label: 'Disconnected' },
};

export function RealtimeStatusIndicator({ status, showLabel = false }: RealtimeStatusIndicatorProps) {
    const config = statusConfig[status];

    return (
        <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
                {status === 'SUBSCRIBED' && (
                    <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.pulseColor} opacity-75`}
                    />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.color}`} />
            </span>
            {showLabel && <span className="text-xs text-muted-foreground">{config.label}</span>}
        </div>
    );
}
