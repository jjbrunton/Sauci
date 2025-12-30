import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Crown, Users, MessageCircle, ChevronRight, ThumbsUp, ThumbsDown, Minus, Gift } from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    is_premium: boolean | null;
    couple_id: string | null;
    created_at: string | null;
}

interface Partner {
    id: string;
    name: string | null;
}

interface Response {
    id: string;
    answer: 'yes' | 'no' | 'maybe';
    created_at: string | null;
    question: {
        id: string;
        text: string;
        pack: {
            name: string;
        };
    };
}

interface Match {
    id: string;
    match_type: 'yes_yes' | 'yes_maybe' | 'maybe_maybe';
    is_new: boolean;
    created_at: string | null;
    question: {
        id: string;
        text: string;
    };
    message_count?: number;
}

const answerIcons = {
    yes: <ThumbsUp className="h-4 w-4 text-green-500" />,
    no: <ThumbsDown className="h-4 w-4 text-red-500" />,
    maybe: <Minus className="h-4 w-4 text-yellow-500" />,
};

const matchTypeLabels = {
    yes_yes: 'Both Yes!',
    yes_maybe: 'Yes + Maybe',
    maybe_maybe: 'Both Maybe',
};

export function UserDetailPage() {
    const { userId } = useParams<{ userId: string }>();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [partner, setPartner] = useState<Partner | null>(null);
    const [responses, setResponses] = useState<Response[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);

    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [expiryType, setExpiryType] = useState('forever');
    const [customDate, setCustomDate] = useState('');
    const [upgrading, setUpgrading] = useState(false);

    const handleUpgrade = async () => {
        if (!profile || !userId) return;
        setUpgrading(true);

        try {
            let expiresAt = null;
            const now = new Date();

            if (expiryType === '1_month') {
                const date = new Date(now);
                date.setMonth(date.getMonth() + 1);
                expiresAt = date.toISOString();
            } else if (expiryType === '1_year') {
                const date = new Date(now);
                date.setFullYear(date.getFullYear() + 1);
                expiresAt = date.toISOString();
            } else if (expiryType === 'custom' && customDate) {
                // Ensure custom date is in the future
                const date = new Date(customDate);
                if (date <= now) {
                    alert('Expiry date must be in the future');
                    setUpgrading(false);
                    return;
                }
                expiresAt = date.toISOString();
            }

            const { error } = await auditedSupabase.insert('subscriptions', {
                user_id: userId,
                revenuecat_app_user_id: 'admin_grant',
                product_id: 'admin_premium',
                status: 'active',
                store: 'manual',
                purchased_at: new Date().toISOString(),
                expires_at: expiresAt,
            });

            if (error) throw error;

            // Refresh profile to get updated is_premium status
            // The trigger sync_premium_on_subscription_change will update the profile
            // We might need a small delay or just wait for the select
            const { data: updatedProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (updatedProfile) {
                setProfile(updatedProfile);
            }

            setUpgradeOpen(false);
            // Optionally add toast here if available in context
            alert('User upgraded to premium successfully!');
        } catch (err) {
            console.error('Failed to upgrade:', err);
            alert('Failed to upgrade user. See console for details.');
        } finally {
            setUpgrading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!userId) return;

            setLoading(true);
            try {
                // Fetch profile
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                setProfile(profileData);

                // Fetch partner if coupled
                if (profileData?.couple_id) {
                    const { data: partnerData } = await supabase
                        .from('profiles')
                        .select('id, name')
                        .eq('couple_id', profileData.couple_id)
                        .neq('id', userId)
                        .single();

                    setPartner(partnerData);
                }

                // Fetch responses with question and pack info
                const { data: responseData } = await supabase
                    .from('responses')
                    .select(`
            id, answer, created_at,
            question:questions (
              id, text,
              pack:question_packs (name)
            )
          `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50);

                setResponses((responseData || []) as unknown as Response[]);

                // Fetch matches if coupled
                if (profileData?.couple_id) {
                    const { data: matchData } = await supabase
                        .from('matches')
                        .select(`
              id, match_type, is_new, created_at,
              question:questions (id, text)
            `)
                        .eq('couple_id', profileData.couple_id)
                        .order('created_at', { ascending: false })
                        .limit(50);

                    // Get message counts for each match
                    const matchIds = (matchData || []).map(m => m.id);
                    const { data: messages } = await supabase
                        .from('messages')
                        .select('match_id')
                        .in('match_id', matchIds);

                    const messageCounts: Record<string, number> = {};
                    messages?.forEach(m => {
                        messageCounts[m.match_id] = (messageCounts[m.match_id] || 0) + 1;
                    });

                    setMatches(
                        (matchData || []).map(m => ({
                            ...m,
                            message_count: messageCounts[m.id] || 0,
                        })) as unknown as Match[]
                    );
                }
            } catch (error) {
                console.error('Failed to load user data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg font-medium">User not found</p>
                <Link to="/users">
                    <Button variant="link">Back to users</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-start gap-6">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="text-2xl">
                                {profile.name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold">
                                    {profile.name || 'Unnamed User'}
                                </h1>
                                {profile.is_premium && (
                                    <Badge className="bg-amber-500">
                                        <Crown className="h-3 w-3 mr-1" />
                                        Premium
                                    </Badge>

                                )}
                                {!profile.is_premium && (
                                    <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="ml-2 gap-1 h-7">
                                                <Gift className="h-3.5 w-3.5" />
                                                Gift Premium
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Gift Premium Access</DialogTitle>
                                                <DialogDescription>
                                                    Manually upgrade this user to premium status.
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="expiry-type">Duration</Label>
                                                    <Select value={expiryType} onValueChange={setExpiryType}>
                                                        <SelectTrigger id="expiry-type">
                                                            <SelectValue placeholder="Select duration" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="forever">Lifetime (No Expiry)</SelectItem>
                                                            <SelectItem value="1_month">1 Month</SelectItem>
                                                            <SelectItem value="1_year">1 Year</SelectItem>
                                                            <SelectItem value="custom">Custom Date</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {expiryType === 'custom' && (
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="custom-date">Expiry Date</Label>
                                                        <Input
                                                            id="custom-date"
                                                            type="datetime-local"
                                                            value={customDate}
                                                            onChange={(e) => setCustomDate(e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
                                                    Cancel
                                                </Button>
                                                <Button onClick={handleUpgrade} disabled={upgrading}>
                                                    {upgrading ? 'Upgrading...' : 'Confirm Upgrade'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>

                            <p className="text-muted-foreground mb-4">
                                {profile.email || 'No email'}
                            </p>

                            <div className="flex gap-6 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Joined: </span>
                                    <span>
                                        {profile.created_at
                                            ? format(new Date(profile.created_at), 'MMMM d, yyyy')
                                            : '—'}
                                    </span>
                                </div>

                                {partner ? (
                                    <div className="flex items-center gap-1">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Paired with: </span>
                                        <Link to={`/users/${partner.id}`} className="text-primary hover:underline">
                                            {partner.name || 'Unnamed Partner'}
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground">Not paired</div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="responses">
                <TabsList>
                    <TabsTrigger value="responses">
                        Responses ({responses.length})
                    </TabsTrigger>
                    <TabsTrigger value="matches" disabled={!profile.couple_id}>
                        Matches ({matches.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="responses" className="mt-4">
                    {responses.length === 0 ? (
                        <Card className="flex flex-col items-center justify-center py-12">
                            <p className="text-muted-foreground">No responses yet</p>
                        </Card>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Question</TableHead>
                                        <TableHead>Pack</TableHead>
                                        <TableHead className="w-24">Answer</TableHead>
                                        <TableHead className="w-32">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {responses.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell className="max-w-md">
                                                <span className="line-clamp-2">{r.question.text}</span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {r.question.pack?.name || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {answerIcons[r.answer]}
                                                    <span className="capitalize">{r.answer}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {r.created_at
                                                    ? format(new Date(r.created_at), 'MMM d, yyyy')
                                                    : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="matches" className="mt-4">
                    {matches.length === 0 ? (
                        <Card className="flex flex-col items-center justify-center py-12">
                            <p className="text-muted-foreground">No matches yet</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {matches.map((match) => (
                                <Card key={match.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <Badge variant="secondary">
                                                {matchTypeLabels[match.match_type]}
                                            </Badge>
                                            {match.is_new && (
                                                <Badge variant="default" className="text-xs">New</Badge>
                                            )}
                                        </div>
                                        <CardDescription className="line-clamp-2 mt-2">
                                            {match.question?.text || 'Unknown question'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <MessageCircle className="h-4 w-4" />
                                                {match.message_count} message{match.message_count !== 1 ? 's' : ''}
                                            </div>
                                            <Link to={`/users/${userId}/matches/${match.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    View Chat
                                                    <ChevronRight className="ml-1 h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
