import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Users, ClipboardList, ArrowRight, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export function DashboardPage() {
    const { isSuperAdmin } = useAuth();
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

    const contentCards = [
        {
            title: 'Categories',
            description: 'Manage question categories and organize your packs',
            icon: <LayoutGrid className="h-8 w-8" />,
            href: '/categories',
            color: 'bg-rose-500',
        },
    ];

    const adminCards = [
        {
            title: 'Users',
            description: 'View user profiles, responses, and chat history',
            icon: <Users className="h-8 w-8" />,
            href: '/users',
            color: 'bg-blue-500',
        },
        {
            title: 'Audit Logs',
            description: 'Track all admin actions and changes',
            icon: <ClipboardList className="h-8 w-8" />,
            href: '/audit-logs',
            color: 'bg-amber-500',
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Welcome back! Manage your Sauci content and users.
                </p>
            </div>

            {/* Content Management */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Content Management</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {contentCards.map((card) => (
                        <Card key={card.href} className="group hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className={`w-14 h-14 rounded-lg ${card.color} text-white flex items-center justify-center mb-2`}>
                                    {card.icon}
                                </div>
                                <CardTitle>{card.title}</CardTitle>
                                <CardDescription>{card.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link to={card.href}>
                                    <Button variant="ghost" className="group-hover:translate-x-1 transition-transform">
                                        Open
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Super Admin Only */}
            {isSuperAdmin && (
                <section>
                    <h2 className="text-xl font-semibold mb-4">Administration</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {adminCards.map((card) => (
                            <Card key={card.href} className="group hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <div className={`w-14 h-14 rounded-lg ${card.color} text-white flex items-center justify-center mb-2`}>
                                        {card.icon}
                                    </div>
                                    <CardTitle>{card.title}</CardTitle>
                                    <CardDescription>{card.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Link to={card.href}>
                                        <Button variant="ghost" className="group-hover:translate-x-1 transition-transform">
                                            Open
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Quick Stats - Takes up 4 columns */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Quick Stats</CardTitle>
                        <CardDescription>Overview of your platform's content and users</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">Categories</p>
                                <div className="text-2xl font-bold">
                                    {loading ? <Skeleton className="h-8 w-16" /> : stats.categories}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">Packs</p>
                                <div className="text-2xl font-bold">
                                    {loading ? <Skeleton className="h-8 w-16" /> : stats.packs}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">Questions</p>
                                <div className="text-2xl font-bold">
                                    {loading ? <Skeleton className="h-8 w-16" /> : stats.questions}
                                </div>
                            </div>
                            {isSuperAdmin && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                                    <div className="text-2xl font-bold">
                                        {loading ? <Skeleton className="h-8 w-16" /> : stats.users}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Message Activity Chart - Takes up 3 columns */}
                <Card className="col-span-3">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            <CardTitle>Message Activity</CardTitle>
                        </div>
                        <CardDescription>Messages sent over the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            {loading ? (
                                <Skeleton className="h-full w-full" />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={messageStats}>
                                        <XAxis
                                            dataKey="date"
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `${value}`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                            }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="currentColor"
                                            radius={[4, 4, 0, 0]}
                                            className="fill-primary"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
