import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, supabaseConfig } from '@/config';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, CheckCheck, Eye, Video as VideoIcon } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { PaginationControls } from '@/components/ui/pagination';

interface Profile {
    id: string;
    name: string | null;
    avatar_url: string | null;
}

interface Match {
    id: string;
    match_type: 'yes_yes' | 'yes_maybe' | 'maybe_maybe';
    question: {
        id: string;
        text: string;
    };
}

interface Message {
    id: string;
    user_id: string;
    content: string | null;
    media_path: string | null;
    media_type: 'image' | 'video' | null;
    created_at: string;
    read_at: string | null;
    media_viewed_at: string | null;
    version?: number | null;
    encrypted_content?: string | null;
    encryption_iv?: string | null;
    keys_metadata?: Record<string, unknown> | null;
}

const matchTypeLabels = {
    yes_yes: 'Both Yes!',
    yes_maybe: 'Yes + Maybe',
    maybe_maybe: 'Both Maybe',
};

function formatMessageTime(date: Date): string {
    if (isToday(date)) {
        return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
        return 'Yesterday ' + format(date, 'h:mm a');
    }
    return format(date, 'MMM d, h:mm a');
}



function ChatImage({ messageId }: { messageId: string }) {
    const { session, isSuperAdmin } = useAuth();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!messageId) return;

        if (!isSuperAdmin) {
            setError('Decryption requires super admin');
            return;
        }

        if (!session?.access_token) {
            setError('Not authenticated');
            return;
        }

        let cancelled = false;
        let objectUrl: string | null = null;

        const load = async () => {
            try {
                setError(null);
                setUrl(null);

                const res = await fetch(`${supabaseConfig.url}/functions/v1/admin-decrypt-media`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: supabaseConfig.anonKey,
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ messageId }),
                });

                if (!res.ok) {
                    const raw = await res.text().catch(() => '');
                    let message = raw;
                    try {
                        const parsed = JSON.parse(raw) as { error?: unknown };
                        if (typeof parsed?.error === 'string') message = parsed.error;
                    } catch {
                        // ignore
                    }
                    throw new Error(message || `Failed to load media (${res.status})`);
                }

                const blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);

                if (cancelled) return;
                setUrl(objectUrl);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load');
            }
        };

        load();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [messageId, isSuperAdmin, session?.access_token]);

    if (error) {
        return (
            <div className="h-32 w-32 rounded-lg bg-muted flex flex-col items-center justify-center border border-red-200 p-2">
                <span className="text-xs text-red-500 text-center">Failed to load</span>
                <span className="text-[10px] text-muted-foreground mt-1 text-center truncate w-full" title={error}>
                    {error}
                </span>
            </div>
        );
    }

    if (!url) return <Skeleton className="h-48 w-48 rounded-lg" />;

    return (
        <img
            src={url}
            alt="Shared media"
            className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(url, '_blank')}
        />
    );
}


function ChatVideo({ messageId }: { messageId: string }) {
    const { session, isSuperAdmin } = useAuth();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!messageId) return;

        if (!isSuperAdmin) {
            setError('Decryption requires super admin');
            return;
        }

        if (!session?.access_token) {
            setError('Not authenticated');
            return;
        }

        let cancelled = false;
        let objectUrl: string | null = null;

        const load = async () => {
            try {
                setError(null);
                setUrl(null);

                const res = await fetch(`${supabaseConfig.url}/functions/v1/admin-decrypt-media`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: supabaseConfig.anonKey,
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ messageId }),
                });

                if (!res.ok) {
                    const raw = await res.text().catch(() => '');
                    let message = raw;
                    try {
                        const parsed = JSON.parse(raw) as { error?: unknown };
                        if (typeof parsed?.error === 'string') message = parsed.error;
                    } catch {
                        // ignore
                    }
                    throw new Error(message || `Failed to load media (${res.status})`);
                }

                const blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);

                if (cancelled) return;
                setUrl(objectUrl);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load');
            }
        };

        load();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [messageId, isSuperAdmin, session?.access_token]);

    if (error) {
        return (
            <div className="h-48 w-64 rounded-lg bg-muted flex flex-col items-center justify-center border border-red-200 p-2">
                <VideoIcon className="h-8 w-8 text-red-400 mb-2" />
                <span className="text-xs text-red-500 text-center">Failed to load video</span>
                <span className="text-[10px] text-muted-foreground mt-1 text-center truncate w-full" title={error}>
                    {error}
                </span>
            </div>
        );
    }

    if (!url) {
        return (
            <div className="h-48 w-64 rounded-lg bg-muted flex items-center justify-center">
                <Skeleton className="h-full w-full rounded-lg" />
            </div>
        );
    }

    return (
        <div className="relative">
            <video
                src={url}
                controls
                className="max-w-xs rounded-lg"
                preload="metadata"
            >
                Your browser does not support the video tag.
            </video>
        </div>
    );
}


function DecryptedMessageText({ message }: { message: Message }) {
    const { isSuperAdmin } = useAuth();
    const [text, setText] = useState<string | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);

    useEffect(() => {
        const version = message.version ?? 1;

        // v1: legacy plaintext
        if (version !== 2) {
            setText(message.content ?? null);
            setIsDecrypting(false);
            return;
        }

        // v2: encrypted
        if (!message.encrypted_content) {
            setText(null);
            setIsDecrypting(false);
            return;
        }

        if (!isSuperAdmin) {
            setText('[Encrypted]');
            setIsDecrypting(false);
            return;
        }

        let cancelled = false;

        const decrypt = async () => {
            setIsDecrypting(true);
            try {
                const { data, error } = await supabase.functions.invoke('admin-decrypt-message', {
                    body: { messageId: message.id },
                });

                if (cancelled) return;

                if (error) {
                    setText('[Unable to decrypt]');
                    return;
                }

                setText((data as { content?: string | null } | null)?.content ?? null);
            } catch (err) {
                if (cancelled) return;
                setText('[Unable to decrypt]');
            } finally {
                if (!cancelled) setIsDecrypting(false);
            }
        };

        decrypt();

        return () => {
            cancelled = true;
        };
    }, [isSuperAdmin, message.content, message.encrypted_content, message.id, message.version]);

    const shouldRender = Boolean(message.content || message.encrypted_content);
    if (!shouldRender) return null;

    return (
        <p className="text-sm whitespace-pre-wrap">
            {isDecrypting ? 'Loading...' : (text ?? '')}
        </p>
    );
}


export function MatchChatPage() {
    const { userId, matchId } = useParams<{ userId: string; matchId: string }>();
    const [user, setUser] = useState<Profile | null>(null);
    const [partner, setPartner] = useState<Profile | null>(null);
    const [match, setMatch] = useState<Match | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const fetchData = useCallback(async () => {
        if (!userId || !matchId) return;

        setLoading(true);
        try {
            // Fetch user profile
            const { data: userData } = await supabase
                .from('profiles')
                .select('id, name, avatar_url, couple_id')
                .eq('id', userId)
                .single();

            setUser(userData);

            // Fetch partner
            if (userData?.couple_id) {
                const { data: partnerData } = await supabase
                    .from('profiles')
                    .select('id, name, avatar_url')
                    .eq('couple_id', userData.couple_id)
                    .neq('id', userId)
                    .single();

                setPartner(partnerData);
            } else {
                setPartner(null);
            }

            // Fetch match with question
            const { data: matchData } = await supabase
                .from('matches')
                .select(`
            id, match_type,
            question:questions (id, text)
          `)
                .eq('id', matchId)
                .single();

            setMatch(matchData as unknown as Match);

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            // Fetch messages
            const { data: messageData, error: messagesError, count } = await supabase
                .from('messages')
                .select('*', { count: 'exact' })
                .eq('match_id', matchId)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (messagesError) throw messagesError;

            setTotalCount(count || 0);
            const orderedMessages = (messageData || []).slice().reverse();
            setMessages(orderedMessages);
        } catch (error) {
            console.error('Failed to load chat data:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, matchId, page, pageSize]);

    // Real-time subscription for messages in this chat
    const { status: realtimeStatus } = useRealtimeSubscription<Message>({
        table: 'messages',
        filter: matchId ? `match_id=eq.${matchId}` : undefined,
        enabled: !!matchId,
        onInsert: useCallback(() => {
            fetchData();
        }, [fetchData]),
        onUpdate: useCallback(() => {
            fetchData();
        }, [fetchData]),
        onDelete: useCallback(() => {
            fetchData();
        }, [fetchData]),
    });

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, pageSize, totalCount]);

    useEffect(() => {
        setPage(1);
    }, [matchId]);

    const getProfile = (senderId: string): Profile | null => {
        if (senderId === user?.id) return user;
        if (senderId === partner?.id) return partner;
        return null;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-20" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!match || !user) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg font-medium">Chat not found</p>
                <Link to={`/users/${userId}`}>
                    <Button variant="link">Back to user</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to={`/users/${userId}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold">Match Chat</h1>
                        <Badge variant="secondary">
                            {matchTypeLabels[match.match_type]}
                        </Badge>
                        <RealtimeStatusIndicator status={realtimeStatus} showLabel />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                        {match.question?.text}
                    </p>
                </div>
            </div>

            {/* Participants */}
            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Participants
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex gap-6 pb-4">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>
                                {user.name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{user.name || 'Unnamed'}</p>
                            <p className="text-xs text-muted-foreground">Current User</p>
                        </div>
                    </div>
                    {partner && (
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={partner.avatar_url || undefined} />
                                <AvatarFallback>
                                    {partner.name?.charAt(0).toUpperCase() || 'P'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{partner.name || 'Unnamed'}</p>
                                <Link to={`/users/${partner.id}`} className="text-xs text-primary hover:underline">
                                    View Profile
                                </Link>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Messages */}
            <Card className="min-h-[400px]">
                <CardHeader className="py-4 border-b">
                    <CardTitle className="text-sm font-medium">
                        Messages ({totalCount})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <p>No messages in this chat yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((message) => {
                                const sender = getProfile(message.user_id);
                                const isUserMessage = message.user_id === userId;

                                return (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex gap-3",
                                            isUserMessage ? "flex-row-reverse" : ""
                                        )}
                                    >
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarImage src={sender?.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs">
                                                {sender?.name?.charAt(0).toUpperCase() || '?'}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className={cn(
                                            "max-w-[70%] space-y-1",
                                            isUserMessage ? "items-end" : "items-start"
                                        )}>
                                            <div
                                                className={cn(
                                                    "rounded-2xl px-4 py-2",
                                                    isUserMessage
                                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                        : "bg-muted rounded-tl-sm"
                                                )}
                                            >
                                                <DecryptedMessageText message={message} />
                                                {message.media_path && (
                                                    <div className="mt-2">
                                                        <div className="relative group">
                                                            {message.media_type === 'video' ? (
                                                                <ChatVideo messageId={message.id} />
                                                            ) : (
                                                                <ChatImage messageId={message.id} />
                                                            )}
                                                            {message.media_viewed_at && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="absolute bottom-2 right-2 text-xs"
                                                                >
                                                                    <Eye className="h-3 w-3 mr-1" />
                                                                    Viewed
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={cn(
                                                "flex items-center gap-1 text-xs text-muted-foreground px-1",
                                                isUserMessage ? "justify-end" : ""
                                            )}>
                                                <span>{formatMessageTime(new Date(message.created_at))}</span>
                                                {isUserMessage && (
                                                    message.read_at ? (
                                                        <CheckCheck className="h-3 w-3 text-primary" />
                                                    ) : (
                                                        <Check className="h-3 w-3" />
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {totalCount > 0 && (
                        <div className="mt-4">
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
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
