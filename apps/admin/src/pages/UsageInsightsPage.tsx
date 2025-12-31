import { useState, useEffect } from 'react';
import { supabase } from '@/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Users, MessageSquare, Flame, Heart, Smile, Shield, TrendingUp, PieChart } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Pie, PieChart as RechartsPieChart } from 'recharts';

type UsageReason = 'improve_communication' | 'spice_up_intimacy' | 'deeper_connection' | 'have_fun' | 'strengthen_relationship';

interface UsageReasonStat {
    reason: UsageReason | null;
    count: number;
    percentage: number;
}

interface GenderStat {
    gender: string | null;
    count: number;
    percentage: number;
}

const usageReasonConfig: Record<UsageReason, { label: string; icon: React.ReactNode; color: string }> = {
    improve_communication: {
        label: 'Improve communication',
        icon: <MessageSquare className="h-5 w-5" />,
        color: '#3b82f6',
    },
    spice_up_intimacy: {
        label: 'Spice up intimacy',
        icon: <Flame className="h-5 w-5" />,
        color: '#ef4444',
    },
    deeper_connection: {
        label: 'Build deeper connection',
        icon: <Heart className="h-5 w-5" />,
        color: '#ec4899',
    },
    have_fun: {
        label: 'Have fun together',
        icon: <Smile className="h-5 w-5" />,
        color: '#f59e0b',
    },
    strengthen_relationship: {
        label: 'Strengthen relationship',
        icon: <Shield className="h-5 w-5" />,
        color: '#10b981',
    },
};

const genderConfig: Record<string, { label: string; color: string }> = {
    male: { label: 'Male', color: '#3b82f6' },
    female: { label: 'Female', color: '#ec4899' },
    'non-binary': { label: 'Non-binary', color: '#8b5cf6' },
    'prefer-not-to-say': { label: 'Prefer not to say', color: '#6b7280' },
};

export function UsageInsightsPage() {
    const [usageStats, setUsageStats] = useState<UsageReasonStat[]>([]);
    const [genderStats, setGenderStats] = useState<GenderStat[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [onboardedUsers, setOnboardedUsers] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Get total users count
                const { count: total } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });

                setTotalUsers(total || 0);

                // Get onboarded users count
                const { count: onboarded } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('onboarding_completed', true);

                setOnboardedUsers(onboarded || 0);

                // Get usage reason breakdown
                const { data: usageData } = await supabase
                    .from('profiles')
                    .select('usage_reason')
                    .not('usage_reason', 'is', null);

                const usageCounts: Record<string, number> = {};
                usageData?.forEach(profile => {
                    const reason = profile.usage_reason as string;
                    usageCounts[reason] = (usageCounts[reason] || 0) + 1;
                });

                const totalWithReason = Object.values(usageCounts).reduce((a, b) => a + b, 0);
                const usageStatsArray: UsageReasonStat[] = Object.entries(usageCounts)
                    .map(([reason, count]) => ({
                        reason: reason as UsageReason,
                        count,
                        percentage: totalWithReason > 0 ? Math.round((count / totalWithReason) * 100) : 0,
                    }))
                    .sort((a, b) => b.count - a.count);

                setUsageStats(usageStatsArray);

                // Get gender breakdown
                const { data: genderData } = await supabase
                    .from('profiles')
                    .select('gender')
                    .not('gender', 'is', null);

                const genderCounts: Record<string, number> = {};
                genderData?.forEach(profile => {
                    const gender = profile.gender as string;
                    genderCounts[gender] = (genderCounts[gender] || 0) + 1;
                });

                const totalWithGender = Object.values(genderCounts).reduce((a, b) => a + b, 0);
                const genderStatsArray: GenderStat[] = Object.entries(genderCounts)
                    .map(([gender, count]) => ({
                        gender,
                        count,
                        percentage: totalWithGender > 0 ? Math.round((count / totalWithGender) * 100) : 0,
                    }))
                    .sort((a, b) => b.count - a.count);

                setGenderStats(genderStatsArray);
            } catch (error) {
                console.error('Failed to fetch usage stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const chartData = usageStats.map(stat => ({
        name: stat.reason ? usageReasonConfig[stat.reason]?.label || stat.reason : 'Unknown',
        value: stat.count,
        color: stat.reason ? usageReasonConfig[stat.reason]?.color : '#6b7280',
    }));

    const pieData = genderStats.map(stat => ({
        name: stat.gender ? genderConfig[stat.gender]?.label || stat.gender : 'Unknown',
        value: stat.count,
        color: stat.gender ? genderConfig[stat.gender]?.color : '#6b7280',
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Target className="h-8 w-8 text-primary" />
                    Usage Insights
                </h1>
                <p className="text-muted-foreground">
                    Understand why users are using Sauci based on onboarding responses
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed Onboarding</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{onboardedUsers.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">
                                    {totalUsers > 0 ? Math.round((onboardedUsers / totalUsers) * 100) : 0}% of total users
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                        <PieChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {usageStats.reduce((sum, s) => sum + s.count, 0).toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    users provided usage reason
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Usage Reasons Chart */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            Why Users Join Sauci
                        </CardTitle>
                        <CardDescription>
                            Distribution of user motivations from onboarding
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-[300px] w-full" />
                        ) : usageStats.length === 0 ? (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No usage data available yet
                            </div>
                        ) : (
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={150}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                            }}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Gender Distribution */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Gender Distribution
                        </CardTitle>
                        <CardDescription>
                            User demographics from onboarding
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-[300px] w-full" />
                        ) : genderStats.length === 0 ? (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No gender data available yet
                            </div>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={({ name, percent }) =>
                                                `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                                            }
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                            }}
                                        />
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Detailed Breakdown</CardTitle>
                    <CardDescription>
                        Individual statistics for each usage reason
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : usageStats.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No usage data available yet
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {usageStats.map(stat => {
                                const config = stat.reason ? usageReasonConfig[stat.reason] : null;
                                return (
                                    <div
                                        key={stat.reason}
                                        className="flex items-center gap-4 p-4 rounded-lg border"
                                    >
                                        <div
                                            className="p-3 rounded-lg"
                                            style={{ backgroundColor: `${config?.color}20` }}
                                        >
                                            <div style={{ color: config?.color }}>
                                                {config?.icon}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{config?.label || stat.reason}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${stat.percentage}%`,
                                                            backgroundColor: config?.color,
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm text-muted-foreground w-12 text-right">
                                                    {stat.percentage}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold">{stat.count}</p>
                                            <p className="text-xs text-muted-foreground">users</p>
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
