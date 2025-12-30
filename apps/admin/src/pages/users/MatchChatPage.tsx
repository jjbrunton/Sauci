import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, CheckCheck, Eye } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

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
    created_at: string;
    read_at: string | null;
    media_viewed_at: string | null;
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



function ChatImage({ mediaPath }: { mediaPath: string }) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!mediaPath) return;
        const getUrl = async () => {
            try {
                // Handle legacy full URLs
                let path = mediaPath;
                if (path.startsWith('http')) {
                    const parts = path.split('/chat-media/');
                    if (parts.length > 1) {
                        path = decodeURIComponent(parts[1]);
                    }
                }


                const { data, error } = await supabase.storage
                    .from('chat-media')
                    .createSignedUrl(path, 3600);

                if (error) {
                    console.error('Error creating signed URL:', error);
                    setError(error.message);
                    return;
                }

                if (data?.signedUrl) {
                    setUrl(data.signedUrl);
                }
            } catch (err) {
                console.error('Unexpected error loading image:', err);
                setError('Failed to load');
            }
        };
        getUrl();
    }, [mediaPath]);

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


export function MatchChatPage() {
    const { userId, matchId } = useParams<{ userId: string; matchId: string }>();
    const [user, setUser] = useState<Profile | null>(null);
    const [partner, setPartner] = useState<Profile | null>(null);
    const [match, setMatch] = useState<Match | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
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

                // Fetch messages
                const { data: messageData } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('match_id', matchId)
                    .order('created_at', { ascending: true });

                setMessages(messageData || []);
            } catch (error) {
                console.error('Failed to load chat data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId, matchId]);

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
                        Messages ({messages.length})
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
                                                {message.content && (
                                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                )}
                                                {message.media_path && (
                                                    <div className="mt-2">
                                                        <div className="relative group">
                                                            <ChatImage mediaPath={message.media_path} />
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
                </CardContent>
            </Card>
        </div>
    );
}
