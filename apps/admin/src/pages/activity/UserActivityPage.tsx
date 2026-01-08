import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { PaginationControls } from '@/components/ui/pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
    Activity,
    ThumbsUp,
    ThumbsDown,
    Minus,
    Heart,
    MessageCircle,
    UserPlus,
    ExternalLink,
} from 'lucide-react';

// Types
interface ResponseActivity {
    id: string;
    user_id: string;
    answer: 'yes' | 'no' | 'maybe';
    created_at: string;
    profile: {
        id: string;
        name: string | null;
        email: string | null;
    } | null;
    question: {
        id: string;
        text: string;
        pack: {
            name: string;
        } | null;
    } | null;
}

interface MatchActivity {
    id: string;
    couple_id: string;
    match_type: 'yes_yes' | 'yes_maybe' | 'maybe_maybe';
    is_new: boolean;
    created_at: string;
    question: {
        id: string;
        text: string;
    } | null;
    coupleProfiles?: Array<{
        id: string;
        name: string | null;
        email: string | null;
    }>;
}

interface MessageActivity {
    id: string;
    user_id: string;
    content: string | null;
    media_path: string | null;
    media_type: 'image' | 'video' | null;
    created_at: string;
    profile: {
        id: string;
        name: string | null;
        email: string | null;
    } | null;
    match: {
        id: string;
        question: {
            text: string;
        } | null;
    } | null;
}

interface SignupActivity {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    created_at: string;
    onboarding_completed: boolean | null;
    couple_id: string | null;
}

type ActivityTab = 'responses' | 'matches' | 'messages' | 'signups';

// Answer icons
const answerConfig = {
    yes: { icon: <ThumbsUp className="h-4 w-4" />, color: 'text-green-500', bg: 'bg-green-500/10' },
    no: { icon: <ThumbsDown className="h-4 w-4" />, color: 'text-red-500', bg: 'bg-red-500/10' },
    maybe: { icon: <Minus className="h-4 w-4" />, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
};

const matchTypeLabels = {
    yes_yes: { label: 'Both Yes!', variant: 'default' as const },
    yes_maybe: { label: 'Yes + Maybe', variant: 'secondary' as const },
    maybe_maybe: { label: 'Both Maybe', variant: 'outline' as const },
};

export function UserActivityPage() {
    const [activeTab, setActiveTab] = useState<ActivityTab>('responses');
    const [responses, setResponses] = useState<ResponseActivity[]>([]);
    const [matches, setMatches] = useState<MatchActivity[]>([]);
    const [messages, setMessages] = useState<MessageActivity[]>([]);
    const [signups, setSignups] = useState<SignupActivity[]>([]);
    const [responsesPage, setResponsesPage] = useState(1);
    const [responsesPageSize, setResponsesPageSize] = useState(25);
    const [responsesTotal, setResponsesTotal] = useState(0);
    const [matchesPage, setMatchesPage] = useState(1);
    const [matchesPageSize, setMatchesPageSize] = useState(25);
    const [matchesTotal, setMatchesTotal] = useState(0);
    const [messagesPage, setMessagesPage] = useState(1);
    const [messagesPageSize, setMessagesPageSize] = useState(25);
    const [messagesTotal, setMessagesTotal] = useState(0);
    const [signupsPage, setSignupsPage] = useState(1);
    const [signupsPageSize, setSignupsPageSize] = useState(25);
    const [signupsTotal, setSignupsTotal] = useState(0);
    const [loading, setLoading] = useState({
        responses: true,
        matches: true,
        messages: true,
        signups: true,
    });

    // Fetch responses
    const fetchResponses = useCallback(async () => {
        setLoading(prev => ({ ...prev, responses: true }));
        try {
            const from = (responsesPage - 1) * responsesPageSize;
            const to = from + responsesPageSize - 1;

            const { data, error, count } = await supabase
                .from('responses')
                .select(`
                    id, user_id, answer, created_at,
                    profile:profiles!responses_user_id_fkey(id, name, email),
                    question:questions(
                        id, text,
                        pack:question_packs(name)
                    )
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setResponsesTotal(count || 0);

            // Transform data to match our types (Supabase returns nested objects, not arrays for 1:1 relations)
            const transformed: ResponseActivity[] = (data || []).map((item: any) => ({
                id: item.id,
                user_id: item.user_id,
                answer: item.answer,
                created_at: item.created_at,
                profile: item.profile,
                question: item.question ? {
                    id: item.question.id,
                    text: item.question.text,
                    pack: item.question.pack,
                } : null,
            }));
            setResponses(transformed);
        } catch (error) {
            console.error('Failed to load responses:', error);
            toast.error("Failed to load responses");
        } finally {
            setLoading(prev => ({ ...prev, responses: false }));
        }
    }, [responsesPage, responsesPageSize]);

    // Fetch matches with couple profiles
    const fetchMatches = useCallback(async () => {
        setLoading(prev => ({ ...prev, matches: true }));
        try {
            const from = (matchesPage - 1) * matchesPageSize;
            const to = from + matchesPageSize - 1;

            const { data: matchesData, error: matchesError, count } = await supabase
                .from('matches')
                .select(`
                    id, couple_id, match_type, is_new, created_at,
                    question:questions(id, text)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (matchesError) throw matchesError;

            setMatchesTotal(count || 0);

            // Get unique couple IDs and fetch profiles
            const coupleIds = [...new Set((matchesData || []).map((m: any) => m.couple_id))];
            if (coupleIds.length > 0) {
                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, name, email, couple_id')
                    .in('couple_id', coupleIds);

                if (profilesError) throw profilesError;

                // Attach profiles to matches
                const matchesWithProfiles: MatchActivity[] = (matchesData || []).map((match: any) => ({
                    id: match.id,
                    couple_id: match.couple_id,
                    match_type: match.match_type,
                    is_new: match.is_new,
                    created_at: match.created_at,
                    question: match.question,
                    coupleProfiles: (profiles || []).filter((p: any) => p.couple_id === match.couple_id),
                }));
                setMatches(matchesWithProfiles);
            } else {
                const transformed: MatchActivity[] = (matchesData || []).map((match: any) => ({
                    id: match.id,
                    couple_id: match.couple_id,
                    match_type: match.match_type,
                    is_new: match.is_new,
                    created_at: match.created_at,
                    question: match.question,
                    coupleProfiles: [],
                }));
                setMatches(transformed);
            }
        } catch (error) {
            console.error('Failed to load matches:', error);
            toast.error("Failed to load matches");
        } finally {
            setLoading(prev => ({ ...prev, matches: false }));
        }
    }, [matchesPage, matchesPageSize]);

    // Fetch messages
    const fetchMessages = useCallback(async () => {
        setLoading(prev => ({ ...prev, messages: true }));
        try {
            const from = (messagesPage - 1) * messagesPageSize;
            const to = from + messagesPageSize - 1;

            // Fetch messages with match data
            const { data: messagesData, error: messagesError, count } = await supabase
                .from('messages')
                .select(`
                    id, user_id, content, media_path, media_type, created_at,
                    match:matches(
                        id,
                        question:questions(text)
                    )
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (messagesError) throw messagesError;

            setMessagesTotal(count || 0);

            // Get unique user IDs and fetch profiles
            const userIds = [...new Set((messagesData || []).map((m: any) => m.user_id))];
            let profilesMap: Record<string, { id: string; name: string | null; email: string | null }> = {};

            if (userIds.length > 0) {
                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, name, email')
                    .in('id', userIds);

                if (profilesError) throw profilesError;

                profilesMap = (profiles || []).reduce((acc: any, p: any) => {
                    acc[p.id] = p;
                    return acc;
                }, {});
            }

            // Transform data to match our types
            const transformed: MessageActivity[] = (messagesData || []).map((item: any) => ({
                id: item.id,
                user_id: item.user_id,
                content: item.content,
                media_path: item.media_path,
                media_type: item.media_type,
                created_at: item.created_at,
                profile: profilesMap[item.user_id] || null,
                match: item.match ? {
                    id: item.match.id,
                    question: item.match.question,
                } : null,
            }));
            setMessages(transformed);
        } catch (error) {
            console.error('Failed to load messages:', error);
            toast.error("Failed to load messages");
        } finally {
            setLoading(prev => ({ ...prev, messages: false }));
        }
    }, [messagesPage, messagesPageSize]);

    // Fetch signups
    const fetchSignups = useCallback(async () => {
        setLoading(prev => ({ ...prev, signups: true }));
        try {
            const from = (signupsPage - 1) * signupsPageSize;
            const to = from + signupsPageSize - 1;

            const { data, error, count } = await supabase
                .from('profiles')
                .select('id, name, email, avatar_url, created_at, onboarding_completed, couple_id', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            setSignups(data || []);
            setSignupsTotal(count || 0);
        } catch (error) {
            console.error('Failed to load signups:', error);
            toast.error("Failed to load signups");
        } finally {
            setLoading(prev => ({ ...prev, signups: false }));
        }
    }, [signupsPage, signupsPageSize]);

    // Real-time subscriptions
    const { status: responsesStatus } = useRealtimeSubscription({
        table: 'responses',
        onInsert: useCallback(() => fetchResponses(), [fetchResponses]),
        insertToast: { enabled: true, message: () => 'New response', type: 'info' },
    });

    const { status: matchesStatus } = useRealtimeSubscription({
        table: 'matches',
        onInsert: useCallback(() => fetchMatches(), [fetchMatches]),
        insertToast: { enabled: true, message: () => 'New match!', type: 'success' },
    });

    const { status: messagesStatus } = useRealtimeSubscription({
        table: 'messages',
        onInsert: useCallback(() => fetchMessages(), [fetchMessages]),
        insertToast: { enabled: true, message: () => 'New message', type: 'info' },
    });

    const { status: signupsStatus } = useRealtimeSubscription({
        table: 'profiles',
        onInsert: useCallback(() => fetchSignups(), [fetchSignups]),
        insertToast: { enabled: true, message: () => 'New user signed up!', type: 'success' },
    });

    // Fetch all data on mount
    useEffect(() => {
        fetchResponses();
        fetchMatches();
        fetchMessages();
        fetchSignups();
    }, [fetchResponses, fetchMatches, fetchMessages, fetchSignups]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(responsesTotal / responsesPageSize));
        if (responsesPage > totalPages) {
            setResponsesPage(totalPages);
        }
    }, [responsesPage, responsesPageSize, responsesTotal]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(matchesTotal / matchesPageSize));
        if (matchesPage > totalPages) {
            setMatchesPage(totalPages);
        }
    }, [matchesPage, matchesPageSize, matchesTotal]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(messagesTotal / messagesPageSize));
        if (messagesPage > totalPages) {
            setMessagesPage(totalPages);
        }
    }, [messagesPage, messagesPageSize, messagesTotal]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(signupsTotal / signupsPageSize));
        if (signupsPage > totalPages) {
            setSignupsPage(totalPages);
        }
    }, [signupsPage, signupsPageSize, signupsTotal]);

    // Get current realtime status based on active tab
    const getCurrentRealtimeStatus = () => {
        switch (activeTab) {
            case 'responses': return responsesStatus;
            case 'matches': return matchesStatus;
            case 'messages': return messagesStatus;
            case 'signups': return signupsStatus;
        }
    };

    // Render user link
    const renderUserLink = (profile: { id: string; name: string | null; email: string | null } | null) => {
        if (!profile) return <span className="text-muted-foreground">Unknown User</span>;
        return (
            <Link
                to={`/users/${profile.id}`}
                className="text-primary hover:underline"
            >
                {profile.name || profile.email || 'Unknown'}
            </Link>
        );
    };

    // Render answer badge
    const renderAnswerBadge = (answer: 'yes' | 'no' | 'maybe') => {
        const config = answerConfig[answer];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${config.bg} ${config.color}`}>
                {config.icon}
                <span className="text-sm font-medium capitalize">{answer}</span>
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Activity className="h-8 w-8 text-primary" />
                            User Activity
                        </h1>
                        <RealtimeStatusIndicator status={getCurrentRealtimeStatus()} showLabel />
                    </div>
                    <p className="text-muted-foreground">
                        Monitor recent user activity across the platform
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActivityTab)}>
                <TabsList className="grid w-full grid-cols-4 max-w-[600px]">
                    <TabsTrigger value="responses" className="gap-2">
                        <ThumbsUp className="h-4 w-4" />
                        Responses
                    </TabsTrigger>
                    <TabsTrigger value="matches" className="gap-2">
                        <Heart className="h-4 w-4" />
                        Matches
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Messages
                    </TabsTrigger>
                    <TabsTrigger value="signups" className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Signups
                    </TabsTrigger>
                </TabsList>

                {/* Responses Tab */}
                <TabsContent value="responses" className="mt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Question</TableHead>
                                    <TableHead>Pack</TableHead>
                                    <TableHead>Answer</TableHead>
                                    <TableHead>Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading.responses ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                        </TableCell>
                                    </TableRow>
                                ) : responses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No responses yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    responses.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{renderUserLink(item.profile)}</TableCell>
                                            <TableCell className="max-w-[300px]">
                                                <span className="truncate block">
                                                    {item.question?.text || 'Unknown question'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {item.question?.pack?.name || 'Unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{renderAnswerBadge(item.answer)}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {responsesTotal > 0 && (
                        <PaginationControls
                            page={responsesPage}
                            pageSize={responsesPageSize}
                            totalCount={responsesTotal}
                            onPageChange={setResponsesPage}
                            onPageSizeChange={(size) => {
                                setResponsesPage(1);
                                setResponsesPageSize(size);
                            }}
                        />
                    )}
                </TabsContent>

                {/* Matches Tab */}
                <TabsContent value="matches" className="mt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Couple</TableHead>
                                    <TableHead>Question</TableHead>
                                    <TableHead>Match Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading.matches ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                        </TableCell>
                                    </TableRow>
                                ) : matches.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No matches yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    matches.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {item.coupleProfiles && item.coupleProfiles.length > 0 ? (
                                                        <>
                                                            {renderUserLink(item.coupleProfiles[0])}
                                                            {item.coupleProfiles.length > 1 && (
                                                                <>
                                                                    <span className="text-muted-foreground mx-1">&</span>
                                                                    {renderUserLink(item.coupleProfiles[1])}
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground">Unknown couple</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[300px]">
                                                <span className="truncate block">
                                                    {item.question?.text || 'Unknown question'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={matchTypeLabels[item.match_type]?.variant || 'secondary'}>
                                                    {matchTypeLabels[item.match_type]?.label || item.match_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {item.is_new ? (
                                                    <Badge variant="destructive">New</Badge>
                                                ) : (
                                                    <Badge variant="outline">Viewed</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {matchesTotal > 0 && (
                        <PaginationControls
                            page={matchesPage}
                            pageSize={matchesPageSize}
                            totalCount={matchesTotal}
                            onPageChange={setMatchesPage}
                            onPageSizeChange={(size) => {
                                setMatchesPage(1);
                                setMatchesPageSize(size);
                            }}
                        />
                    )}
                </TabsContent>

                {/* Messages Tab */}
                <TabsContent value="messages" className="mt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Context</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading.messages ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">
                                            <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                        </TableCell>
                                    </TableRow>
                                ) : messages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No messages yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    messages.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{renderUserLink(item.profile)}</TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <span className="truncate block text-muted-foreground text-sm">
                                                    {item.match?.question?.text || 'Unknown match'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                            </TableCell>
                                            <TableCell>
                                                {item.match && item.profile ? (
                                                    <Link
                                                        to={`/users/${item.profile.id}/matches/${item.match.id}`}
                                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        View Chat
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {messagesTotal > 0 && (
                        <PaginationControls
                            page={messagesPage}
                            pageSize={messagesPageSize}
                            totalCount={messagesTotal}
                            onPageChange={setMessagesPage}
                            onPageSizeChange={(size) => {
                                setMessagesPage(1);
                                setMessagesPageSize(size);
                            }}
                        />
                    )}
                </TabsContent>

                {/* Signups Tab */}
                <TabsContent value="signups" className="mt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Paired</TableHead>
                                    <TableHead>Joined</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading.signups ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            <div className="flex justify-center"><Skeleton className="h-6 w-32" /></div>
                                        </TableCell>
                                    </TableRow>
                                ) : signups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No signups yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    signups.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Link
                                                    to={`/users/${item.id}`}
                                                    className="flex items-center gap-2 hover:opacity-80"
                                                >
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={item.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-primary/10 text-primary">
                                                            {(item.name || item.email || '?').charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-primary hover:underline">
                                                        {item.name || 'No name'}
                                                    </span>
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {item.email || 'No email'}
                                            </TableCell>
                                            <TableCell>
                                                {item.onboarding_completed ? (
                                                    <Badge variant="default">Onboarded</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Pending</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.couple_id ? (
                                                    <Badge variant="default">Paired</Badge>
                                                ) : (
                                                    <Badge variant="outline">Single</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                                {format(new Date(item.created_at), 'MMM d, yyyy')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {signupsTotal > 0 && (
                        <PaginationControls
                            page={signupsPage}
                            pageSize={signupsPageSize}
                            totalCount={signupsTotal}
                            onPageChange={setSignupsPage}
                            onPageSizeChange={(size) => {
                                setSignupsPage(1);
                                setSignupsPageSize(size);
                            }}
                        />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
