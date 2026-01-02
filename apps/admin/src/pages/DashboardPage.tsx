import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, PERMISSION_KEYS } from '@/contexts/AuthContext';
import { supabase } from '@/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid, Users, ClipboardList, ArrowRight, Activity, Target, TrendingUp, Heart, MessageCircle, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format, subDays, startOfDay, endOfDay, formatDistanceToNow } from 'date-fns';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';

type FeatureInterestChartPoint = { date: string; count: number };

type RecentFeatureInterest = {
    id: string;
    user_id: string;
    feature_name: string;
    created_at: string;
    profile?: {
        id: string;
        name: string | null;
        email: string | null;
        avatar_url: string | null;
    };
};

function formatFeatureName(featureName: string) {
    return featureName
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function DashboardPage() {
    const { hasPermission } = useAuth();
    const canViewUsers = hasPermission(PERMISSION_KEYS.VIEW_USERS);
    const [stats, setStats] = useState({
        categories: 0,
        packs: 0,
        questions: 0,
        users: 0,
    });
    const [messageStats, setMessageStats] = useState<{ date: string; count: number }[]>([]);
    const [featureInterestStats, setFeatureInterestStats] = useState<FeatureInterestChartPoint[]>([]);
    const [recentFeatureInterests, setRecentFeatureInterests] = useState<RecentFeatureInterest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            // Fetch counts
            const [
                { count: categoriesCount },
                { count: packsCount },
                { count: questionsCount },
                { count: usersCount },
            ] = await Promise.all([
                supabase.from('categories').select('*', { count: 'exact', head: true }),
                supabase.from('question_packs').select('*', { count: 'exact', head: true }),
                supabase.from('questions').select('*', { count: 'exact', head: true }),
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
            ]);

            setStats({
                categories: categoriesCount || 0,
                packs: packsCount || 0,
                questions: questionsCount || 0,
                users: usersCount || 0,
            });

            const endDate = endOfDay(new Date());
            const startDate = subDays(startOfDay(new Date()), 6); // Last 7 days including today

            const [
                { data: messages },
                { data: featureInterests },
                { data: recentInterests },
            ] = await Promise.all([
                supabase
                    .from('messages')
                    .select('created_at')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString()),
                supabase
                    .from('feature_interests')
                    .select('created_at, user_id')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString()),
                supabase
                    .from('feature_interests')
                    .select('id, user_id, feature_name, created_at')
                    .order('created_at', { ascending: false })
                    .limit(10),
            ]);

            // Process messages for chart
            const messageDaysMap = new Map<string, number>();
            for (let i = 0; i < 7; i++) {
                const date = subDays(new Date(), 6 - i);
                const key = format(date, 'MMM d');
                messageDaysMap.set(key, 0);
            }

            (messages ?? []).forEach(msg => {
                const date = new Date(msg.created_at);
                const key = format(date, 'MMM d');
                if (messageDaysMap.has(key)) {
                    messageDaysMap.set(key, (messageDaysMap.get(key) || 0) + 1);
                }
            });

            setMessageStats(
                Array.from(messageDaysMap.entries()).map(([date, count]) => ({
                    date,
                    count,
                }))
            );

            // Process feature interests for chart (unique users per day)
            const featureInterestDaysMap = new Map<string, Set<string>>();
            for (let i = 0; i < 7; i++) {
                const date = subDays(new Date(), 6 - i);
                const key = format(date, 'MMM d');
                featureInterestDaysMap.set(key, new Set());
            }

            (featureInterests ?? []).forEach(interest => {
                const date = new Date(interest.created_at);
                const key = format(date, 'MMM d');
                const set = featureInterestDaysMap.get(key);
                if (set) {
                    set.add(interest.user_id);
                }
            });

            setFeatureInterestStats(
                Array.from(featureInterestDaysMap.entries()).map(([date, userIds]) => ({
                    date,
                    count: userIds.size,
                }))
            );

            let recentActivity: RecentFeatureInterest[] = (recentInterests ?? []).map(item => ({
                id: item.id,
                user_id: item.user_id,
                feature_name: item.feature_name,
                created_at: item.created_at,
            }));

            if (canViewUsers && recentActivity.length > 0) {
                const userIds = Array.from(new Set(recentActivity.map(item => item.user_id)));

                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, name, email, avatar_url')
                    .in('id', userIds);

                if (profiles && profiles.length > 0) {
                    const profileById = new Map(profiles.map(profile => [profile.id, profile] as const));

                    recentActivity = recentActivity.map(item => ({
                        ...item,
                        profile: profileById.get(item.user_id),
                    }));
                }
            }

            setRecentFeatureInterests(recentActivity);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    }, [canViewUsers]);

    // Real-time subscriptions for dashboard stats (with debouncing)
    const { status: profilesStatus } = useRealtimeSubscription({
        table: 'profiles',
        onInsert: fetchStats,
        onDelete: fetchStats,
        debounceMs: 2000,
    });

    const { status: messagesStatus } = useRealtimeSubscription({
        table: 'messages',
        onInsert: fetchStats,
        debounceMs: 2000,
    });

    const { status: featureInterestsStatus } = useRealtimeSubscription({
        table: 'feature_interests',
        onInsert: fetchStats,
        onDelete: fetchStats,
        debounceMs: 2000,
        enabled: canViewUsers,
    });

    useRealtimeSubscription({
        table: 'categories',
        onInsert: fetchStats,
        onDelete: fetchStats,
        debounceMs: 2000,
    });

    useRealtimeSubscription({
        table: 'question_packs',
        onInsert: fetchStats,
        onDelete: fetchStats,
        debounceMs: 2000,
    });

    useRealtimeSubscription({
        table: 'questions',
        onInsert: fetchStats,
        onDelete: fetchStats,
        debounceMs: 2000,
    });

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const quickLinks = [
        {
            title: 'Categories',
            description: 'Organize your question packs into themed collections',
            icon: LayoutGrid,
            href: '/categories',
            gradient: 'from-rose-500 to-pink-600',
            permission: PERMISSION_KEYS.MANAGE_CATEGORIES,
        },
        {
            title: 'Users',
            description: 'View user profiles, responses, and activity',
            icon: Users,
            href: '/users',
            gradient: 'from-violet-500 to-purple-600',
            permission: PERMISSION_KEYS.VIEW_USERS,
        },
        {
            title: 'Usage Insights',
            description: 'Understand why users join and how they engage',
            icon: Target,
            href: '/usage-insights',
            gradient: 'from-amber-500 to-orange-600',
            permission: PERMISSION_KEYS.VIEW_USERS,
        },
        {
            title: 'Audit Logs',
            description: 'Track all admin actions and system changes',
            icon: ClipboardList,
            href: '/audit-logs',
            gradient: 'from-emerald-500 to-teal-600',
            permission: PERMISSION_KEYS.VIEW_AUDIT_LOGS,
        },
    ];

    const statCards = [
        { label: 'Categories', value: stats.categories, icon: LayoutGrid, color: 'text-rose-400' },
        { label: 'Packs', value: stats.packs, icon: Heart, color: 'text-violet-400' },
        { label: 'Questions', value: stats.questions, icon: MessageCircle, color: 'text-amber-400' },
        { label: 'Active Users', value: stats.users, icon: Users, color: 'text-emerald-400', permission: PERMISSION_KEYS.VIEW_USERS },
    ];

    const isRealtimeFullySubscribed =
        profilesStatus === 'SUBSCRIBED' &&
        messagesStatus === 'SUBSCRIBED' &&
        (!canViewUsers || featureInterestsStatus === 'SUBSCRIBED');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="relative">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl hidden xl:block" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold tracking-tight">
                            Dashboard
                        </h1>
                        <RealtimeStatusIndicator
                            status={isRealtimeFullySubscribed ? 'SUBSCRIBED' : profilesStatus}
                            showLabel
                        />
                    </div>
                    <p className="text-muted-foreground text-sm md:text-base">
                        Welcome back. Here's what's happening with Sauci.
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards
                    .filter(card => !card.permission || hasPermission(card.permission))
                    .map((stat) => (
                        <Card key={stat.label} className="glass border-white/5 hover:border-white/10 transition-colors">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">
                                            {stat.label}
                                        </p>
                                        <div className="text-3xl font-bold">
                                            {loading ? (
                                                <Skeleton className="h-9 w-16" />
                                            ) : (
                                                stat.value.toLocaleString()
                                            )}
                                        </div>
                                    </div>
                                    <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
                                        <stat.icon className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-7">
                {/* Quick Links - 4 columns */}
                <div className="lg:col-span-4 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Quick Access
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {quickLinks
                            .filter(link => hasPermission(link.permission))
                            .map((link) => (
                                <Link key={link.href} to={link.href} className="group">
                                    <Card className="h-full glass border-white/5 hover:border-white/10 transition-all duration-300 hover:glow-rose-sm overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${link.gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                                                <link.icon className="h-6 w-6 text-white" />
                                            </div>
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                                {link.title}
                                            </CardTitle>
                                            <CardDescription className="text-sm">
                                                {link.description}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="flex items-center text-sm text-muted-foreground group-hover:text-primary transition-colors">
                                                <span>Open</span>
                                                <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                    </div>
                </div>

                {/* Activity Chart - 3 columns */}
                <div className="lg:col-span-3">
                    <Card className="h-full glass border-white/5">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                <CardTitle>Message Activity</CardTitle>
                            </div>
                            <CardDescription>
                                Messages sent over the last 7 days
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[280px]">
                                {loading ? (
                                    <Skeleton className="h-full w-full rounded-xl" />
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={messageStats}>
                                            <XAxis
                                                dataKey="date"
                                                stroke="hsl(var(--muted-foreground))"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                stroke="hsl(var(--muted-foreground))"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${value}`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                contentStyle={{
                                                    borderRadius: '12px',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    background: 'hsl(240 8% 10%)',
                                                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                                }}
                                                labelStyle={{ color: 'hsl(var(--foreground))' }}
                                            />
                                            <defs>
                                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="hsl(340 65% 55%)" />
                                                    <stop offset="100%" stopColor="hsl(320 60% 45%)" />
                                                </linearGradient>
                                            </defs>
                                            <Bar
                                                dataKey="count"
                                                fill="url(#barGradient)"
                                                radius={[6, 6, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Notify Overview - 7 columns */}
                <div className="lg:col-span-7">
                    <Card className="glass border-white/5">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-primary" />
                                <CardTitle>Notify Overview</CardTitle>
                            </div>
                            <CardDescription>
                                Unique users opting into feature updates over the last 7 days
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!canViewUsers ? (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                                    You don’t have permission to view feature opt-ins.
                                </div>
                            ) : (
                                <>
                                    <div className="h-[260px]">
                                        {loading ? (
                                            <Skeleton className="h-full w-full rounded-xl" />
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={featureInterestStats}>
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="hsl(var(--muted-foreground))"
                                                        fontSize={11}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <YAxis
                                                        stroke="hsl(var(--muted-foreground))"
                                                        fontSize={11}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(value) => `${value}`}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                        contentStyle={{
                                                            borderRadius: '12px',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            background: 'hsl(240 8% 10%)',
                                                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                                        }}
                                                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                                                    />
                                                    <defs>
                                                        <linearGradient id="notifyBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="hsl(200 75% 55%)" />
                                                            <stop offset="100%" stopColor="hsl(190 65% 40%)" />
                                                        </linearGradient>
                                                    </defs>
                                                    <Bar
                                                        dataKey="count"
                                                        fill="url(#notifyBarGradient)"
                                                        radius={[6, 6, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-white/5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-medium">Recent opt-ins</h3>
                                            <p className="text-xs text-muted-foreground">Last 10</p>
                                        </div>

                                        {loading ? (
                                            <div className="space-y-3">
                                                {Array.from({ length: 5 }).map((_, idx) => (
                                                    <div key={idx} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 p-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <Skeleton className="h-8 w-8 rounded-full" />
                                                            <div className="min-w-0 space-y-2">
                                                                <Skeleton className="h-4 w-48" />
                                                                <Skeleton className="h-3 w-36" />
                                                            </div>
                                                        </div>
                                                        <Skeleton className="h-3 w-16" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : recentFeatureInterests.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No opt-ins yet.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {recentFeatureInterests.map((item) => {
                                                    const primaryText =
                                                        item.profile?.name ||
                                                        item.profile?.email ||
                                                        `User ${item.user_id.slice(0, 8)}`;

                                                    const subtitleParts: string[] = [];
                                                    if (item.profile?.name && item.profile.email) {
                                                        subtitleParts.push(item.profile.email);
                                                    }
                                                    subtitleParts.push(formatFeatureName(item.feature_name));

                                                    const fallbackChar = (item.profile?.name || item.profile?.email || 'U')
                                                        .charAt(0)
                                                        .toUpperCase();

                                                    return (
                                                        <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 p-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarImage src={item.profile?.avatar_url || undefined} />
                                                                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                                        {fallbackChar}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium truncate">
                                                                        {primaryText}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground truncate">
                                                                        {subtitleParts.join(' • ')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
