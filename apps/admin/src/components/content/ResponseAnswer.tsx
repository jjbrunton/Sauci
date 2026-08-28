import { useEffect, useState } from 'react';
import type { AnswerType, QuestionType } from '@sauci/shared';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Image as ImageIcon, Music2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseConfig } from '@/config';
import { formatAdminResponse, QUESTION_TYPE_LABELS, type AdminResponseData } from '@/lib/questionResponses';

interface ResponseAnswerProps {
    answer: AnswerType;
    responseId?: string;
    questionType?: QuestionType | null;
    responseData?: AdminResponseData;
    responderId?: string;
    responderName?: string | null;
}

export function ResponseAnswer({
    answer,
    responseId,
    questionType,
    responseData = null,
    responderId,
    responderName,
}: ResponseAnswerProps) {
    const formatted = formatAdminResponse(questionType, answer, responseData, { responderId, responderName });
    const resolvedType = questionType ?? 'swipe';

    return (
        <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{formatted.label}</span>
                {resolvedType !== 'swipe' && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                        {QUESTION_TYPE_LABELS[resolvedType]}
                    </Badge>
                )}
            </div>
            {formatted.detail && (
                <p className="max-w-md whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {formatted.detail}
                </p>
            )}
            {(resolvedType === 'photo' || resolvedType === 'audio') && responseId && (
                <ProtectedResponseMedia
                    responseId={responseId}
                    mediaType={resolvedType}
                    label={responderName || 'User response'}
                />
            )}
        </div>
    );
}

function ProtectedResponseMedia({
    responseId,
    mediaType,
    label,
}: {
    responseId: string;
    mediaType: 'photo' | 'audio';
    label: string;
}) {
    const { session } = useAuth();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!session?.access_token) {
            setError('Sign in to load media');
            return;
        }

        let cancelled = false;
        let objectUrl: string | null = null;

        const load = async () => {
            try {
                setError(null);
                const response = await fetch(`${supabaseConfig.url}/functions/v1/admin-response-media`, {
                    method: 'POST',
                    headers: {
                        apikey: supabaseConfig.anonKey,
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ responseId }),
                });

                if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body?.error || `Failed to load media (${response.status})`);
                }

                objectUrl = URL.createObjectURL(await response.blob());
                if (!cancelled) setUrl(objectUrl);
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load media');
                }
            }
        };

        load();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [responseId, session?.access_token]);

    if (error) {
        return (
            <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
                {mediaType === 'photo' ? <ImageIcon className="h-3 w-3" /> : <Music2 className="h-3 w-3" />}
                {error}
            </p>
        );
    }

    if (!url) {
        return <Skeleton className={mediaType === 'photo' ? 'h-20 w-28 rounded-md' : 'h-10 w-64 rounded-md'} />;
    }

    if (mediaType === 'photo') {
        return (
            <button
                type="button"
                className="block overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                aria-label={`Open ${label} photo response`}
            >
                <img
                    src={url}
                    alt={`${label} photo response`}
                    className="h-20 w-28 object-cover transition-transform hover:scale-105"
                />
            </button>
        );
    }

    return (
        <audio
            src={url}
            controls
            preload="metadata"
            className="h-10 w-64 max-w-full"
            aria-label={`Play ${label} audio response`}
        />
    );
}
