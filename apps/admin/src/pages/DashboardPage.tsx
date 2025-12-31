import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, PERMISSION_KEYS } from '@/contexts/AuthContext';
import { supabase } from '@/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid, Users, ClipboardList, ArrowRight, Activity, Target, TrendingUp, Heart, MessageCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export function DashboardPage() {
    const { hasPermission } = useAuth();
    const [stats, setStats] = useState({
        categories: 0,
        packs: 0,
        questions: 0,
        users: 0,
    });
    const [messageStats, setMessageStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
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

                // Fetch message history for chart
                const endDate = endOfDay(new Date());
                const startDate = subDays(startOfDay(new Date()), 6); // Last 7 days including today

                const { data: messages } = await supabase
                    .from('messages')
                    .select('created_at')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString());

                // Process messages for chart
                const daysMap = new Map();
                // Initialize last 7 days with 0
                for (let i = 0; i < 7; i++) {
                    const date = subDays(new Date(), 6 - i);
                    const key = format(date, 'MMM d');
                    daysMap.set(key, 0);
                }

                messages?.forEach(msg => {
                    const date = new Date(msg.created_at);
                    const key = format(date, 'MMM d');
                    if (daysMap.has(key)) {
                        daysMap.set(key, daysMap.get(key) + 1);
                    }
                });

                const chartData = Array.from(daysMap.entries()).map(([date, count]) => ({
                    date,
                    count
                }));

                setMessageStats(chartData);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

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

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="relative">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                <div className="relative">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">
                        Dashboard
                    </h1>
                    <p className="text-muted-foreground text-lg">
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
            </div>
        </div>
    );
}
