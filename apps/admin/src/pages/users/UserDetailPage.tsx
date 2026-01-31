import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, supabaseConfig } from '@/config';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { useAuth, PERMISSION_KEYS } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Crown, Users, MessageCircle, ChevronRight, ThumbsUp, ThumbsDown, Minus, Gift, Image, Video as VideoIcon, Target, User, Eye, EyeOff, CheckCircle, Package, Sparkles, Flame, Trophy, Calendar, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { IconPreview } from '@/components/ui/icon-picker';

type UsageReason = 'improve_communication' | 'spice_up_intimacy' | 'deeper_connection' | 'have_fun' | 'strengthen_relationship';
type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

// ... (interfaces and constants are the same)

interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    is_premium: boolean | null;
    couple_id: string | null;
    created_at: string | null;
    gender: Gender | null;
    usage_reason: UsageReason | null;
    hide_nsfw: boolean | null;
    onboarding_completed: boolean | null;
}

const usageReasonLabels: Record<UsageReason, { label: string; icon: string }> = {
    improve_communication: { label: 'Improve communication', icon: 'chatbubbles' },
    spice_up_intimacy: { label: 'Spice up intimacy', icon: 'flame' },
    deeper_connection: { label: 'Build deeper connection', icon: 'heart' },
    have_fun: { label: 'Have fun together', icon: 'happy' },
    strengthen_relationship: { label: 'Strengthen relationship', icon: 'shield-checkmark' },
};

const genderLabels: Record<Gender, string> = {
    male: 'Male',
    female: 'Female',
    'non-binary': 'Non-binary',
    'prefer-not-to-say': 'Prefer not to say',
};

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
            id: string;
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

interface EnabledPack {
    pack_id: string;
    enabled: boolean;
    created_at: string | null;
    pack: {
        id: string;
        name: string;
        description: string | null;
        icon: string | null;
        is_premium: boolean;
        is_explicit: boolean;
        category: {
            id: string;
            name: string;
        } | null;
    };
}

interface FeatureInterest {
    id: string;
    feature_name: string;
    created_at: string;
}

interface OutstandingQuestion {
    id: string;
    text: string;
    intensity: number | null;
    pack: {
        id: string;
        name: string;
    };
    partner_response: {
        answer: 'yes' | 'no' | 'maybe';
        created_at: string | null;
    };
}

interface CoupleStreak {
    id: string;
    couple_id: string;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
    last_milestone_celebrated: number | null;
    created_at: string;
    updated_at: string;
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


function AdminDecryptedImage({ messageId, alt }: { messageId: string; alt: string }) {
    const { session, isSuperAdmin } = useAuth();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!messageId) return;
        if (!isSuperAdmin) {
            setError("Super admin required");
            return;
        }
        if (!session?.access_token) {
            setError("Not authenticated");
            return;
        }

        let cancelled = false;
        let objectUrl: string | null = null;

        const load = async () => {
            try {
                setError(null);
                const res = await fetch(`${supabaseConfig.url}/functions/v1/admin-decrypt-media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: supabaseConfig.anonKey, Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ messageId }),
                });
                if (!res.ok) {
                    const message = (await res.json().catch(() => ({})))?.error || `Failed to load media (${res.status})`;
                    throw new Error(message);
                }
                const blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);
                if (!cancelled) setUrl(objectUrl);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
            }
        };

        load();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [isSuperAdmin, messageId, session?.access_token]);

    if (error) {
        return <div className="w-full h-full flex items-center justify-center text-center p-2"><Image className="h-8 w-8 text-muted-foreground mx-auto" /><div className="text-[10px] text-red-500 mt-1 line-clamp-2" title={error}>{error}</div></div>;
    }
    if (!url) {
        return <div className="w-full h-full flex items-center justify-center"><Skeleton className="h-16 w-16 rounded-md" /></div>;
    }
    return <img src={url} alt={alt} className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(url, '_blank')} />;
}

function AdminDecryptedVideo({ messageId }: { messageId: string }) {
    const { session, isSuperAdmin } = useAuth();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!messageId) return;
        if (!isSuperAdmin) {
            setError("Super admin required");
            return;
        }
        if (!session?.access_token) {
            setError("Not authenticated");
            return;
        }

        let cancelled = false;
        let objectUrl: string | null = null;

        const load = async () => {
            try {
                setError(null);
                const res = await fetch(`${supabaseConfig.url}/functions/v1/admin-decrypt-media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: supabaseConfig.anonKey, Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ messageId }),
                });
                if (!res.ok) {
                    const message = (await res.json().catch(() => ({})))?.error || `Failed to load media (${res.status})`;
                    throw new Error(message);
                }
                const blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);
                if (!cancelled) setUrl(objectUrl);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
            }
        };

        load();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [isSuperAdmin, messageId, session?.access_token]);

    if (error) {
        return <div className="w-full h-full flex items-center justify-center text-center p-2"><VideoIcon className="h-8 w-8 text-muted-foreground mx-auto" /><div className="text-[10px] text-red-500 mt-1 line-clamp-2" title={error}>{error}</div></div>;
    }
    if (!url) {
        return <div className="w-full h-full flex items-center justify-center"><Skeleton className="h-16 w-16 rounded-md" /></div>;
    }
    return <video src={url} controls className="w-full h-full object-cover" preload="metadata" />;
}

export function UserDetailPage() {
    const { userId } = useParams<{ userId: string }>();
    const { hasPermission } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [partner, setPartner] = useState<Partner | null>(null);
    const [responses, setResponses] = useState<Response[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [mediaMessages, setMediaMessages] = useState<any[]>([]);
    const [enabledPacks, setEnabledPacks] = useState<EnabledPack[]>([]);
    const [featureInterests, setFeatureInterests] = useState<FeatureInterest[]>([]);
    const [streak, setStreak] = useState<CoupleStreak | null>(null);
    const [outstandingQuestions, setOutstandingQuestions] = useState<OutstandingQuestion[]>([]);
    const [outstandingPage, setOutstandingPage] = useState(1);
    const [outstandingPageSize, setOutstandingPageSize] = useState(10);
    const [outstandingTotal, setOutstandingTotal] = useState(0);
    const [gapDisabled, setGapDisabled] = useState(false);
    const [gapThreshold, setGapThreshold] = useState(0);
    const [netGap, setNetGap] = useState(0);
    const [responsesPage, setResponsesPage] = useState(1);
    const [responsesPageSize, setResponsesPageSize] = useState(10);
    const [responsesTotal, setResponsesTotal] = useState(0);
    const [matchesPage, setMatchesPage] = useState(1);
    const [matchesPageSize, setMatchesPageSize] = useState(10);
    const [matchesTotal, setMatchesTotal] = useState(0);
    const [mediaPage, setMediaPage] = useState(1);
    const [mediaPageSize, setMediaPageSize] = useState(12);
    const [mediaTotal, setMediaTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const canViewResponses = hasPermission(PERMISSION_KEYS.VIEW_RESPONSES);
    const canViewMatches = hasPermission(PERMISSION_KEYS.VIEW_MATCHES);
    const canViewMedia = hasPermission(PERMISSION_KEYS.VIEW_MEDIA);
    const canViewChats = hasPermission(PERMISSION_KEYS.VIEW_CHATS);

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
                const date = new Date(customDate);
                if (date <= now) {
                    alert('Expiry date must be in the future');
                    setUpgrading(false);
                    return;
                }
                expiresAt = date.toISOString();
            }
            // Use RPC function which handles permissions internally
            const { error } = await supabase.rpc('admin_gift_premium', {
                target_user_id: userId,
                expires_at_param: expiresAt,
            });
            if (error) throw error;
            const { data: updatedProfile } = await supabase.rpc('get_profile_with_auth_info', { user_id: userId }).single<Profile>();
            if (updatedProfile) setProfile(updatedProfile);
            setUpgradeOpen(false);
            alert('User upgraded to premium successfully!');
        } catch (err) {
            console.error('Failed to upgrade:', err);
            alert('Failed to upgrade user. See console for details.');
        } finally {
            setUpgrading(false);
        }
    };

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data: profileData } = await supabase.rpc('get_profile_with_auth_info', { user_id: userId }).single<Profile>();
            setProfile(profileData);

            // Fetch feature interests for the user
            const { data: featureInterestsData } = await supabase
                .from('feature_interests')
                .select('id, feature_name, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            setFeatureInterests((featureInterestsData || []) as FeatureInterest[]);

            if (profileData?.couple_id) {
                const { data: partnerData } = await supabase.from('profiles').select('id, name').eq('couple_id', profileData.couple_id).neq('id', userId).single();
                setPartner(partnerData);

                // Fetch streak data
                const { data: streakData } = await supabase
                    .from('couple_streaks')
                    .select('*')
                    .eq('couple_id', profileData.couple_id)
                    .maybeSingle();
                setStreak(streakData);
            } else {
                setPartner(null);
                setStreak(null);
            }

            const responsesFrom = (responsesPage - 1) * responsesPageSize;
            const responsesTo = responsesFrom + responsesPageSize - 1;

            const { data: responseData, count: responsesCount, error: responsesError } = await supabase
                .from('responses')
                .select('id, answer, created_at, question:questions(id, text, pack:question_packs(id, name))', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(responsesFrom, responsesTo);

            if (responsesError) throw responsesError;

            setResponses((responseData || []) as unknown as Response[]);
            setResponsesTotal(responsesCount || 0);

            if (profileData?.couple_id) {
                const matchesFrom = (matchesPage - 1) * matchesPageSize;
                const matchesTo = matchesFrom + matchesPageSize - 1;

                const { data: matchData, count: matchesCount, error: matchesError } = await supabase
                    .from('matches')
                    .select('id, match_type, is_new, created_at, question:questions(id, text)', { count: 'exact' })
                    .eq('couple_id', profileData.couple_id)
                    .order('created_at', { ascending: false })
                    .range(matchesFrom, matchesTo);

                if (matchesError) throw matchesError;

                setMatchesTotal(matchesCount || 0);

                const matchIds = (matchData || []).map(m => m.id);
                if (matchIds.length > 0) {
                    const { data: messages } = await supabase.from('messages').select('match_id').in('match_id', matchIds);
                    const messageCounts: Record<string, number> = {};
                    messages?.forEach(m => { messageCounts[m.match_id] = (messageCounts[m.match_id] || 0) + 1; });
                    setMatches((matchData || []).map(m => ({ ...m, message_count: messageCounts[m.id] || 0 })) as unknown as Match[]);
                } else {
                    setMatches([]);
                }

                const { data: allMatchIdsData } = await supabase
                    .from('matches')
                    .select('id')
                    .eq('couple_id', profileData.couple_id);

                const allMatchIds = (allMatchIdsData || []).map(m => m.id);
                if (allMatchIds.length > 0) {
                    const mediaFrom = (mediaPage - 1) * mediaPageSize;
                    const mediaTo = mediaFrom + mediaPageSize - 1;

                    const { data: mediaMessagesData, error: mediaError, count: mediaCount } = await supabase
                        .from('messages')
                        .select('id, user_id, media_path, media_type, version, created_at, keys_metadata, match_id', { count: 'exact' })
                        .in('match_id', allMatchIds)
                        .not('media_path', 'is', null)
                        .order('created_at', { ascending: false })
                        .range(mediaFrom, mediaTo);

                    if (mediaError) {
                        console.error("Error fetching media messages:", mediaError);
                        setMediaMessages([]);
                        setMediaTotal(0);
                    } else {
                        setMediaMessages(mediaMessagesData || []);
                        setMediaTotal(mediaCount || 0);
                    }
                } else {
                    setMediaMessages([]);
                    setMediaTotal(0);
                }
            // Fetch enabled packs for the couple
                const { data: enabledPacksData, error: packsError } = await supabase
                    .from('couple_packs')
                    .select(`
                        pack_id,
                        enabled,
                        created_at,
                        pack:question_packs(
                            id,
                            name,
                            description,
                            icon,
                            is_premium,
                            is_explicit,
                            category:categories(id, name)
                        )
                    `)
                    .eq('couple_id', profileData.couple_id)
                    .eq('enabled', true)
                    .order('created_at', { ascending: false });

                if (packsError) {
                    console.error("Error fetching enabled packs:", packsError);
                    setEnabledPacks([]);
                } else {
                    setEnabledPacks((enabledPacksData || []) as unknown as EnabledPack[]);
                }

                // Fetch outstanding questions (partner answered, user hasn't)
                // Use partner from state (set earlier in the first couple_id block)
                const partnerProfile = partner || (await supabase.from('profiles').select('id, name').eq('couple_id', profileData.couple_id).neq('id', userId).maybeSingle()).data;
                if (partnerProfile) {
                    // Get question IDs user has already answered
                    const { data: userResponseIds } = await supabase
                        .from('responses')
                        .select('question_id')
                        .eq('user_id', userId);
                    const answeredIds = new Set((userResponseIds || []).map((r: any) => r.question_id));

                    // Get all partner responses in this couple
                    const { data: partnerResponses } = await supabase
                        .from('responses')
                        .select(`
                            question_id,
                            answer,
                            created_at
                        `)
                        .eq('user_id', partnerProfile.id)
                        .eq('couple_id', profileData.couple_id)
                        .order('created_at', { ascending: false });

                    // Filter to only questions user hasn't answered
                    const unansweredPartnerResponses = (partnerResponses || []).filter((r: any) => !answeredIds.has(r.question_id));
                    const unansweredQuestionIds = unansweredPartnerResponses.map((r: any) => r.question_id);

                    if (unansweredQuestionIds.length > 0) {
                        // Fetch question details (no pack filter — admin sees all)
                        const { data: questionDetails } = await supabase
                            .from('questions')
                            .select('id, text, intensity, pack:question_packs(id, name)')
                            .in('id', unansweredQuestionIds);

                        const questionMap = new Map((questionDetails || []).map((q: any) => [q.id, q]));
                        const partnerResponseMap = new Map(unansweredPartnerResponses.map((r: any) => [r.question_id, r]));

                        const outstanding: OutstandingQuestion[] = [];
                        for (const qId of unansweredQuestionIds) {
                            const q = questionMap.get(qId);
                            const pr = partnerResponseMap.get(qId);
                            if (q && pr) {
                                outstanding.push({
                                    id: qId,
                                    text: q.text || '',
                                    intensity: q.intensity || null,
                                    pack: { id: q.pack?.id || '', name: q.pack?.name || '' },
                                    partner_response: { answer: pr.answer, created_at: pr.created_at },
                                });
                            }
                        }

                        setOutstandingTotal(outstanding.length);
                        const outFrom = (outstandingPage - 1) * outstandingPageSize;
                        setOutstandingQuestions(outstanding.slice(outFrom, outFrom + outstandingPageSize));
                    } else {
                        setOutstandingQuestions([]);
                        setOutstandingTotal(0);
                    }

                    // Calculate gap status
                    const { data: appConfig } = await supabase
                        .from('app_config')
                        .select('answer_gap_threshold')
                        .limit(1)
                        .maybeSingle();

                    const threshold = appConfig?.answer_gap_threshold ?? 10;
                    setGapThreshold(threshold);

                    if (threshold > 0) {
                        // Count questions user answered that partner hasn't
                        const partnerAllAnswered = new Set((partnerResponses || []).map((r: any) => r.question_id));
                        const { data: userResponses } = await supabase
                            .from('responses')
                            .select('question_id')
                            .eq('user_id', userId)
                            .eq('couple_id', profileData.couple_id);
                        const userAhead = (userResponses || []).filter((r: any) => !partnerAllAnswered.has(r.question_id)).length;
                        const partnerAhead = unansweredPartnerResponses.length;
                        const gap = Math.max(0, userAhead - partnerAhead);
                        setNetGap(gap);
                        setGapDisabled(gap >= threshold);
                    } else {
                        setNetGap(0);
                        setGapDisabled(false);
                    }
                } else {
                    setOutstandingQuestions([]);
                    setOutstandingTotal(0);
                    setGapDisabled(false);
                }
            } else {
                setMatches([]);
                setMatchesTotal(0);
                setMediaMessages([]);
                setMediaTotal(0);
                setEnabledPacks([]);
                setOutstandingQuestions([]);
                setOutstandingTotal(0);
                setGapDisabled(false);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, responsesPage, responsesPageSize, matchesPage, matchesPageSize, mediaPage, mediaPageSize, outstandingPage, outstandingPageSize]);

    const { status: profileStatus } = useRealtimeSubscription<Profile>({ table: 'profiles', filter: userId ? `id=eq.${userId}` : undefined, enabled: !!userId, onUpdate: useCallback(({ new: updated }: { old: Profile; new: Profile }) => { setProfile(updated); }, []) });
    const { status: responsesStatus } = useRealtimeSubscription<Response>({ table: 'responses', filter: userId ? `user_id=eq.${userId}` : undefined, enabled: !!userId, onInsert: fetchData, onDelete: fetchData });

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        setResponsesPage(1);
        setMatchesPage(1);
        setMediaPage(1);
        setOutstandingPage(1);
    }, [userId]);

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
        const totalPages = Math.max(1, Math.ceil(mediaTotal / mediaPageSize));
        if (mediaPage > totalPages) {
            setMediaPage(totalPages);
        }
    }, [mediaPage, mediaPageSize, mediaTotal]);

    if (loading) return <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
    if (!profile) return <div className="flex flex-col items-center justify-center py-12"><p className="text-lg font-medium">User not found</p><Link to="/users"><Button variant="link">Back to users</Button></Link></div>;

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <Card><CardContent className="pt-6"><div className="flex items-start gap-6">
                <Avatar className="h-20 w-20"><AvatarImage src={profile.avatar_url || undefined} /><AvatarFallback className="text-2xl">{profile.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback></Avatar>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold">{profile.name || 'Unnamed User'}</h1>
                        <RealtimeStatusIndicator status={profileStatus === 'SUBSCRIBED' && responsesStatus === 'SUBSCRIBED' ? 'SUBSCRIBED' : profileStatus} showLabel />
                        {profile.is_premium && <Badge className="bg-amber-500"><Crown className="h-3 w-3 mr-1" />Premium</Badge>}
                        {outstandingTotal > 0 && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{outstandingTotal} outstanding</Badge>}
                        {gapDisabled && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Gap blocked ({netGap}/{gapThreshold})</Badge>}
                        {!profile.is_premium && hasPermission(PERMISSION_KEYS.GIFT_PREMIUM) && <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}><DialogTrigger asChild><Button size="sm" variant="outline" className="ml-2 gap-1 h-7"><Gift className="h-3.5 w-3.5" />Gift Premium</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Gift Premium Access</DialogTitle><DialogDescription>Manually upgrade this user to premium status.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="expiry-type">Duration</Label><Select value={expiryType} onValueChange={setExpiryType}><SelectTrigger id="expiry-type"><SelectValue placeholder="Select duration" /></SelectTrigger><SelectContent><SelectItem value="forever">Lifetime (No Expiry)</SelectItem><SelectItem value="1_month">1 Month</SelectItem><SelectItem value="1_year">1 Year</SelectItem><SelectItem value="custom">Custom Date</SelectItem></SelectContent></Select></div>{expiryType === 'custom' && (<div className="grid gap-2"><Label htmlFor="custom-date">Expiry Date</Label><Input id="custom-date" type="datetime-local" value={customDate} onChange={(e) => setCustomDate(e.target.value)} /></div>)}</div><DialogFooter><Button variant="outline" onClick={() => setUpgradeOpen(false)}>Cancel</Button><Button onClick={handleUpgrade} disabled={upgrading}>{upgrading ? 'Upgrading...' : 'Confirm Upgrade'}</Button></DialogFooter></DialogContent></Dialog>}
                    </div>
                    <div className="text-muted-foreground mb-4 flex items-center gap-2">
                        {profile.email ? (
                            <span>{profile.email}</span>
                        ) : (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-200">Guest</Badge>
                        )}
                        {!profile.email && (
                            <span className="text-xs">Not recoverable unless saved in-app</span>
                        )}
                    </div>
                    <div className="flex gap-6 text-sm">
                        <div><span className="text-muted-foreground">Joined: </span><span>{profile.created_at ? format(new Date(profile.created_at), 'MMMM d, yyyy') : '—'}</span></div>
                        {partner ? <div className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Paired with: </span><Link to={`/users/${partner.id}`} className="text-primary hover:underline">{partner.name || 'Unnamed Partner'}</Link></div> : profile.couple_id ? <div className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Users className="h-4 w-4" />Waiting for partner</div> : <div className="text-muted-foreground">Not paired</div>}
                    </div>
                </div>
            </div></CardContent></Card>
            {/* Onboarding Details */}
            <Card><CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" />Onboarding Details</CardTitle><CardDescription>Information collected during user onboarding</CardDescription></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-start gap-3"><div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900"><User className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div><div><p className="text-sm font-medium text-muted-foreground">Gender</p><p className="font-medium">{profile.gender ? genderLabels[profile.gender] : 'Not set'}</p></div></div>
                <div className="flex items-start gap-3"><div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900"><Target className="h-4 w-4 text-purple-600 dark:text-purple-400" /></div><div><p className="text-sm font-medium text-muted-foreground">Why using Sauci</p><p className="font-medium">{profile.usage_reason ? usageReasonLabels[profile.usage_reason]?.label : 'Not set'}</p></div></div>
                <div className="flex items-start gap-3"><div className={`p-2 rounded-lg ${profile.hide_nsfw ? 'bg-gray-100 dark:bg-gray-800' : 'bg-amber-100 dark:bg-amber-900'}`}>{profile.hide_nsfw ? <EyeOff className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />}</div><div><p className="text-sm font-medium text-muted-foreground">Hide NSFW</p><p className="font-medium">{profile.hide_nsfw === null ? 'Not set' : profile.hide_nsfw ? 'Yes' : 'No'}</p></div></div>
                <div className="flex items-start gap-3"><div className={`p-2 rounded-lg ${profile.onboarding_completed ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}><CheckCircle className={`h-4 w-4 ${profile.onboarding_completed ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`} /></div><div><p className="text-sm font-medium text-muted-foreground">Onboarding</p><p className="font-medium">{profile.onboarding_completed ? 'Completed' : 'Not completed'}</p></div></div>
            </div></CardContent></Card>
            {/* Streak Info */}
            {profile.couple_id && streak && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Flame className="h-5 w-5 text-orange-500" />
                            Couple Streak
                        </CardTitle>
                        <CardDescription>Activity streak for this couple</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                                    <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
                                    <p className="font-medium text-xl">{streak.current_streak} day{streak.current_streak !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                                    <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Longest Streak</p>
                                    <p className="font-medium text-xl">{streak.longest_streak} day{streak.longest_streak !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Last Active</p>
                                    <p className="font-medium">{streak.last_active_date ? format(new Date(streak.last_active_date), 'MMM d, yyyy') : 'Never'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Last Milestone</p>
                                    <p className="font-medium">{streak.last_milestone_celebrated ? `${streak.last_milestone_celebrated} days` : 'None yet'}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            {/* Feature Opt-Ins */}
            {featureInterests.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Feature Opt-Ins
                        </CardTitle>
                        <CardDescription>Features the user has expressed interest in</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {featureInterests.map((interest) => (
                                <Badge key={interest.id} variant="secondary" className="capitalize">
                                    {interest.feature_name}
                                    <span className="ml-1 text-xs text-muted-foreground">
                                        ({format(new Date(interest.created_at), 'MMM d')})
                                    </span>
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
            {/* Tabs */}
            <Tabs defaultValue={canViewResponses ? "responses" : canViewMatches ? "matches" : canViewMedia ? "media" : "responses"}>
                <TabsList>
                    {canViewResponses && <TabsTrigger value="responses">Responses ({responsesTotal})</TabsTrigger>}
                    {canViewMatches && <TabsTrigger value="matches" disabled={!profile.couple_id}>Matches ({matchesTotal})</TabsTrigger>}
                    {canViewMedia && <TabsTrigger value="media">Media ({mediaTotal})</TabsTrigger>}
                    {canViewResponses && <TabsTrigger value="outstanding" disabled={!profile.couple_id || !partner}>Outstanding ({outstandingTotal}){gapDisabled && <AlertCircle className="h-3 w-3 ml-1 text-destructive" />}</TabsTrigger>}
                    <TabsTrigger value="packs" disabled={!profile.couple_id}>Enabled Packs ({enabledPacks.length})</TabsTrigger>
                </TabsList>
                {canViewResponses && <TabsContent value="responses" className="mt-4">{responses.length === 0 ? <Card className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">No responses yet</p></Card> : <div className="space-y-4"><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Pack</TableHead><TableHead className="w-24">Answer</TableHead><TableHead className="w-32">Date</TableHead></TableRow></TableHeader><TableBody>{responses.map((r) => (<TableRow key={r.id}><TableCell className="max-w-md">{r.question.pack?.id ? (<Link to={`/packs/${r.question.pack.id}/questions`} className="line-clamp-2 text-primary hover:underline cursor-pointer">{r.question.text}</Link>) : (<span className="line-clamp-2">{r.question.text}</span>)}</TableCell><TableCell>{r.question.pack?.id ? (<Link to={`/packs/${r.question.pack.id}/questions`} className="text-primary hover:underline">{r.question.pack.name}</Link>) : (<span className="text-muted-foreground">{r.question.pack?.name || '—'}</span>)}</TableCell><TableCell><div className="flex items-center gap-2">{answerIcons[r.answer]}<span className="capitalize">{r.answer}</span></div></TableCell><TableCell className="text-muted-foreground text-sm">{r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : '—'}</TableCell></TableRow>))}</TableBody></Table></div><PaginationControls page={responsesPage} pageSize={responsesPageSize} totalCount={responsesTotal} onPageChange={setResponsesPage} onPageSizeChange={(size) => { setResponsesPage(1); setResponsesPageSize(size); }} /></div>}</TabsContent>}
                {canViewMatches && <TabsContent value="matches" className="mt-4">{matches.length === 0 ? <Card className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">No matches yet</p></Card> : <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{matches.map((match) => (<Card key={match.id} className="hover:shadow-md transition-shadow"><CardHeader className="pb-2"><div className="flex items-start justify-between"><Badge variant="secondary">{matchTypeLabels[match.match_type]}</Badge>{match.is_new && <Badge variant="default" className="text-xs">New</Badge>}</div><CardDescription className="line-clamp-2 mt-2">{match.question?.text || 'Unknown question'}</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between"><div className="flex items-center gap-1 text-sm text-muted-foreground"><MessageCircle className="h-4 w-4" />{match.message_count} message{match.message_count !== 1 ? 's' : ''}</div>{canViewChats && <Link to={`/users/${userId}/matches/${match.id}`}><Button variant="ghost" size="sm">View Chat<ChevronRight className="ml-1 h-4 w-4" /></Button></Link>}</div></CardContent></Card>))}</div><PaginationControls page={matchesPage} pageSize={matchesPageSize} totalCount={matchesTotal} onPageChange={setMatchesPage} onPageSizeChange={(size) => { setMatchesPage(1); setMatchesPageSize(size); }} /></div>}</TabsContent>}
                {canViewMedia && <TabsContent value="media" className="mt-4">{mediaMessages.length === 0 ? <Card className="flex flex-col items-center justify-center py-12"><Image className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">No media uploaded</p></Card> : <div className="space-y-4"><div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{mediaMessages.map((message) => (<Card key={message.id} className="overflow-hidden"><div className="aspect-square bg-muted relative">
                    {message.media_type === 'video' ? (
                        <AdminDecryptedVideo messageId={message.id} />
                    ) : (
                        <AdminDecryptedImage messageId={message.id} alt={`Media from ${message.created_at}`} />
                    )}
                </div><CardContent className="p-3"><div className="flex items-center justify-between text-sm"><div className="truncate text-muted-foreground">{message.media_type === 'video' ? 'Video' : 'Image'}</div>{canViewChats && message.match_id && <Link to={`/users/${userId}/matches/${message.match_id}`} className="text-primary hover:underline text-xs">View Chat</Link>}</div><div className="text-xs text-muted-foreground mt-1">{message.created_at ? format(new Date(message.created_at), 'MMM d, yyyy') : '—'}</div></CardContent></Card>))}</div><PaginationControls page={mediaPage} pageSize={mediaPageSize} totalCount={mediaTotal} onPageChange={setMediaPage} onPageSizeChange={(size) => { setMediaPage(1); setMediaPageSize(size); }} /></div>}</TabsContent>}
                {canViewResponses && <TabsContent value="outstanding" className="mt-4">
                    {gapDisabled && (
                        <Card className="mb-4 border-destructive/50 bg-destructive/5">
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center gap-2 text-destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="font-medium">Gap disabled</span>
                                    <span className="text-muted-foreground text-sm">- This user is {netGap} questions ahead of their partner (threshold: {gapThreshold}). They won't see new questions until their partner catches up.</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {outstandingQuestions.length === 0 ? (
                        <Card className="flex flex-col items-center justify-center py-12">
                            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                            <p className="text-muted-foreground">No outstanding questions - all caught up!</p>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Question</TableHead>
                                            <TableHead>Pack</TableHead>
                                            <TableHead className="w-24">Intensity</TableHead>
                                            <TableHead className="w-32">Partner's Answer</TableHead>
                                            <TableHead className="w-36">Partner Answered</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {outstandingQuestions.map((q) => (
                                            <TableRow key={q.id}>
                                                <TableCell className="max-w-md">
                                                    {q.pack?.id ? (
                                                        <Link to={`/packs/${q.pack.id}/questions`} className="line-clamp-2 text-primary hover:underline cursor-pointer">{q.text}</Link>
                                                    ) : (
                                                        <span className="line-clamp-2">{q.text}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {q.pack?.id ? (
                                                        <Link to={`/packs/${q.pack.id}/questions`} className="text-primary hover:underline">{q.pack.name}</Link>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {q.intensity ? (
                                                        <div className="flex items-center gap-1">
                                                            {Array.from({ length: q.intensity }, (_, i) => (
                                                                <Flame key={i} className="h-3 w-3 text-orange-500" />
                                                            ))}
                                                        </div>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {answerIcons[q.partner_response.answer]}
                                                        <span className="capitalize">{q.partner_response.answer}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {q.partner_response.created_at ? format(new Date(q.partner_response.created_at), 'MMM d, yyyy') : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <PaginationControls
                                page={outstandingPage}
                                pageSize={outstandingPageSize}
                                totalCount={outstandingTotal}
                                onPageChange={setOutstandingPage}
                                onPageSizeChange={(size) => { setOutstandingPage(1); setOutstandingPageSize(size); }}
                            />
                        </div>
                    )}
                </TabsContent>}
                <TabsContent value="packs" className="mt-4">
                    {enabledPacks.length === 0 ? (
                        <Card className="flex flex-col items-center justify-center py-12">
                            <Package className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No packs enabled</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {enabledPacks.map((ep) => (
                                <Link key={ep.pack_id} to={`/packs/${ep.pack.id}/questions`}>
                                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <IconPreview value={ep.pack.icon} fallback="heart-outline" className="text-2xl" />
                                                    <CardTitle className="text-base">{ep.pack.name}</CardTitle>
                                                </div>
                                                <div className="flex gap-1">
                                                    {ep.pack.is_explicit && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            NSFW
                                                        </Badge>
                                                    )}
                                                    {ep.pack.is_premium && (
                                                        <Badge className="bg-amber-500 text-xs">
                                                            <Crown className="h-3 w-3 mr-1" />
                                                            Premium
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            {ep.pack.description && (
                                                <CardDescription className="line-clamp-2 mt-2">
                                                    {ep.pack.description}
                                                </CardDescription>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {ep.pack.category?.name || 'Uncategorized'}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    Enabled {ep.created_at ? format(new Date(ep.created_at), 'MMM d, yyyy') : '—'}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
