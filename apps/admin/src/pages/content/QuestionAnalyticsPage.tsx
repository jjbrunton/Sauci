import { useEffect, useState } from 'react';
import { supabase } from '@/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Pie, PieChart as RechartsPieChart } from 'recharts';
import { Crown, MessageCircle, PieChart, Sparkles, Tag, Eye, EyeOff } from 'lucide-react';

type QuestionType = 'swipe' | 'text_answer' | 'audio' | 'photo' | 'who_likely';

interface QuestionRow {
    id: string;
    pack_id: string;
    intensity: number | null;
    partner_text: string | null;
    inverse_of?: string | null;
    question_type?: QuestionType | null;
}

interface PackRow {
    id: string;
    name: string;
    is_premium: boolean;
    is_explicit: boolean;
    is_public: boolean;
    category_id: string | null;
    category?: { name: string } | { name: string }[] | null;
}

interface TopicRow {
    id: string;
    name: string;
}

interface PackTopicRow {
    pack_id: string;
    topic_id: string;
    topics: TopicRow | TopicRow[] | null;
}

interface BreakdownItem {
    id: string;
    name: string;
    count: number;
}

interface PackBreakdownItem {
    id: string;
    name: string;
    count: number;
    isPremium: boolean;
    category: string;
}

interface ChartDatum {
    name: string;
    value: number;
    color: string;
    [key: string]: string | number;
}

type SegmentKey = 'all' | 'premium' | 'free';

const QUESTION_TYPE_CONFIG: Record<QuestionType, { label: string; color: string }> = {
    swipe: { label: 'Swipe', color: '#38bdf8' },
    text_answer: { label: 'Text', color: '#f59e0b' },
    audio: { label: 'Audio', color: '#a78bfa' },
    photo: { label: 'Photo', color: '#f472b6' },
    who_likely: { label: 'Who Likely', color: '#22c55e' },
};

const formatPercent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

const getCategoryName = (category?: PackRow['category']) => {
    if (!category) return 'Uncategorized';
    if (Array.isArray(category)) {
        return category[0]?.name || 'Uncategorized';
    }
    return category.name || 'Uncategorized';
};

const normalizeTopics = (topics?: PackTopicRow['topics']) => {
    if (!topics) return [] as TopicRow[];
    return Array.isArray(topics) ? topics : [topics];
};

type PublishFilter = 'all' | 'published' | 'unpublished';

export function QuestionAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [publishFilter, setPublishFilter] = useState<PublishFilter>('published');
    const [stats, setStats] = useState({
        totalQuestions: 0,
        premiumQuestions: 0,
        freeQuestions: 0,
        taggedQuestions: 0,
    });
    const [premiumBreakdown, setPremiumBreakdown] = useState<ChartDatum[]>([]);
    const [questionTypeBreakdown, setQuestionTypeBreakdown] = useState<ChartDatum[]>([]);
    const [topicBreakdown, setTopicBreakdown] = useState<Record<SegmentKey, BreakdownItem[]>>({
        all: [],
        premium: [],
        free: [],
    });
    const [categoryBreakdown, setCategoryBreakdown] = useState<Record<SegmentKey, BreakdownItem[]>>({
        all: [],
        premium: [],
        free: [],
    });
    const [packBreakdown, setPackBreakdown] = useState<Record<SegmentKey, PackBreakdownItem[]>>({
        all: [],
        premium: [],
        free: [],
    });
    const [tagSegment, setTagSegment] = useState<SegmentKey>('all');
    const [categorySegment, setCategorySegment] = useState<SegmentKey>('all');
    const [packSegment, setPackSegment] = useState<SegmentKey>('all');

    useEffect(() => {
        const fetchAllQuestions = async () => {
            const pageSize = 1000;
            let page = 0;
            const allQuestions: QuestionRow[] = [];

            while (true) {
                const from = page * pageSize;
                const to = from + pageSize - 1;
                const { data, error } = await supabase
                    .from('questions')
                    .select('id, pack_id, intensity, partner_text, inverse_of, question_type')
                    .range(from, to);

                if (error) throw error;

                const batch = data || [];
                allQuestions.push(...batch);

                if (batch.length < pageSize) {
                    break;
                }

                page += 1;
            }

            return allQuestions;
        };

        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                // Build pack query with optional is_public filter
                let packQuery = supabase
                    .from('question_packs')
                    .select('id, name, is_premium, is_explicit, is_public, category_id, category:categories(name)');

                if (publishFilter === 'published') {
                    packQuery = packQuery.eq('is_public', true);
                } else if (publishFilter === 'unpublished') {
                    packQuery = packQuery.eq('is_public', false);
                }

                const [packsResult, topicsResult, packTopicsResult, questions] = await Promise.all([
                    packQuery,
                    supabase
                        .from('topics')
                        .select('id, name')
                        .order('name'),
                    supabase
                        .from('pack_topics')
                        .select('pack_id, topic_id, topics(id, name)'),
                    fetchAllQuestions(),
                ]);

                if (packsResult.error) throw packsResult.error;
                if (topicsResult.error) throw topicsResult.error;
                if (packTopicsResult.error) throw packTopicsResult.error;

                const packs = (packsResult.data || []) as PackRow[];
                const topics = (topicsResult.data || []) as TopicRow[];
                const packTopics = (packTopicsResult.data || []) as PackTopicRow[];

                const packById = new Map<string, PackRow>();
                packs.forEach((pack) => {
                    packById.set(pack.id, pack);
                });

                const seedTopicCounts = () => new Map<string, BreakdownItem>(
                    topics.map((topic) => [topic.id, { id: topic.id, name: topic.name, count: 0 }])
                );

                const topicCountsBySegment: Record<SegmentKey, Map<string, BreakdownItem>> = {
                    all: seedTopicCounts(),
                    premium: seedTopicCounts(),
                    free: seedTopicCounts(),
                };

                const packTopicsMap = new Map<string, TopicRow[]>();
                packTopics.forEach((relation) => {
                    const topicsForPack = packTopicsMap.get(relation.pack_id) || [];
                    const topicsList = normalizeTopics(relation.topics);

                    if (topicsList.length === 0) return;

                    topicsForPack.push(...topicsList);
                    packTopicsMap.set(relation.pack_id, topicsForPack);
                });

                const untaggedCounts: Record<SegmentKey, number> = { all: 0, premium: 0, free: 0 };
                const questionTypeCounts: Record<QuestionType, number> = {
                    swipe: 0,
                    text_answer: 0,
                    audio: 0,
                    photo: 0,
                    who_likely: 0,
                };
                const categoryCountsBySegment: Record<SegmentKey, Map<string, BreakdownItem>> = {
                    all: new Map(),
                    premium: new Map(),
                    free: new Map(),
                };
                const packCountsBySegment: Record<SegmentKey, Map<string, PackBreakdownItem>> = {
                    all: new Map(),
                    premium: new Map(),
                    free: new Map(),
                };

                let premiumCount = 0;
                let freeCount = 0;
                let taggedCount = 0;

                const primaryQuestions = questions.filter((question) => question.inverse_of == null);

                primaryQuestions.forEach((question) => {
                    const pack = packById.get(question.pack_id);
                    const isPremium = pack?.is_premium ?? false;
                    const segmentKey: SegmentKey = isPremium ? 'premium' : 'free';
                    const categoryName = getCategoryName(pack?.category);
                    const categoryId = pack?.category_id || 'uncategorized';
                    const questionType = question.question_type ?? 'swipe';

                    questionTypeCounts[questionType] = (questionTypeCounts[questionType] || 0) + 1;

                    if (isPremium) {
                        premiumCount += 1;
                    } else {
                        freeCount += 1;
                    }

                    const updatePackCounts = (key: SegmentKey) => {
                        const map = packCountsBySegment[key];
                        const packEntry = map.get(question.pack_id) || {
                            id: question.pack_id,
                            name: pack?.name || 'Unknown Pack',
                            count: 0,
                            isPremium: isPremium,
                            category: categoryName,
                        };
                        packEntry.count += 1;
                        map.set(question.pack_id, packEntry);
                    };

                    updatePackCounts('all');
                    updatePackCounts(segmentKey);

                    const updateCategoryCounts = (key: SegmentKey) => {
                        const map = categoryCountsBySegment[key];
                        const categoryEntry = map.get(categoryId) || {
                            id: categoryId,
                            name: categoryName,
                            count: 0,
                        };
                        categoryEntry.count += 1;
                        map.set(categoryId, categoryEntry);
                    };

                    updateCategoryCounts('all');
                    updateCategoryCounts(segmentKey);

                    const topicsForPack = packTopicsMap.get(question.pack_id) || [];
                    if (topicsForPack.length > 0) {
                        taggedCount += 1;
                        topicsForPack.forEach((topic) => {
                            const updateCounts = (map: Map<string, BreakdownItem>) => {
                                const topicEntry = map.get(topic.id) || {
                                    id: topic.id,
                                    name: topic.name,
                                    count: 0,
                                };
                                topicEntry.count += 1;
                                map.set(topic.id, topicEntry);
                            };

                            updateCounts(topicCountsBySegment.all);
                            updateCounts(topicCountsBySegment[segmentKey]);
                        });
                    } else {
                        untaggedCounts.all += 1;
                        untaggedCounts[segmentKey] += 1;
                    }
                });

                const totalQuestions = primaryQuestions.length;
                const premiumData: ChartDatum[] = [
                    { name: 'Premium', value: premiumCount, color: '#f59e0b' },
                    { name: 'Free', value: freeCount, color: '#22c55e' },
                ];
                const questionTypeData: ChartDatum[] = (Object.entries(QUESTION_TYPE_CONFIG) as Array<
                    [QuestionType, { label: string; color: string }]
                >).map(([key, config]) => ({
                    name: config.label,
                    value: questionTypeCounts[key],
                    color: config.color,
                }));

                const buildTopicData = (key: SegmentKey) => {
                    const data = Array.from(topicCountsBySegment[key].values());
                    if (untaggedCounts[key] > 0 || data.length === 0) {
                        data.push({ id: 'untagged', name: 'Untagged', count: untaggedCounts[key] });
                    }

                    data.sort((a, b) => b.count - a.count);
                    return data;
                };

                const topicData = {
                    all: buildTopicData('all'),
                    premium: buildTopicData('premium'),
                    free: buildTopicData('free'),
                };

                const buildCategoryData = (key: SegmentKey) =>
                    Array.from(categoryCountsBySegment[key].values()).sort((a, b) => b.count - a.count);
                const buildPackData = (key: SegmentKey) =>
                    Array.from(packCountsBySegment[key].values()).sort((a, b) => b.count - a.count);

                const categoryData = {
                    all: buildCategoryData('all'),
                    premium: buildCategoryData('premium'),
                    free: buildCategoryData('free'),
                };

                const packData = {
                    all: buildPackData('all'),
                    premium: buildPackData('premium'),
                    free: buildPackData('free'),
                };

                setStats({
                    totalQuestions,
                    premiumQuestions: premiumCount,
                    freeQuestions: freeCount,
                    taggedQuestions: taggedCount,
                });
                setPremiumBreakdown(premiumData);
                setQuestionTypeBreakdown(questionTypeData);
                setTopicBreakdown(topicData);
                setCategoryBreakdown(categoryData);
                setPackBreakdown(packData);
            } catch (error) {
                console.error('Failed to fetch question analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [publishFilter]);

    const premiumPercent = formatPercent(stats.premiumQuestions, stats.totalQuestions);
    const freePercent = formatPercent(stats.freeQuestions, stats.totalQuestions);
    const taggedPercent = formatPercent(stats.taggedQuestions, stats.totalQuestions);

    const segmentOptions: { key: SegmentKey; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'premium', label: 'Premium' },
        { key: 'free', label: 'Free' },
    ];

    const segmentLabelByKey: Record<SegmentKey, string> = {
        all: 'All',
        premium: 'Premium',
        free: 'Free',
    };

    const totalBySegment: Record<SegmentKey, number> = {
        all: stats.totalQuestions,
        premium: stats.premiumQuestions,
        free: stats.freeQuestions,
    };

    const segmentShareByKey: Record<SegmentKey, string> = {
        all: '100',
        premium: stats.totalQuestions ? ((stats.premiumQuestions / stats.totalQuestions) * 100).toFixed(0) : '0',
        free: stats.totalQuestions ? ((stats.freeQuestions / stats.totalQuestions) * 100).toFixed(0) : '0',
    };

    const tagData = topicBreakdown[tagSegment];
    const categoryData = categoryBreakdown[categorySegment];
    const packData = packBreakdown[packSegment];

    const publishFilterOptions: { key: PublishFilter; label: string; icon: typeof Eye }[] = [
        { key: 'all', label: 'All Packs', icon: Eye },
        { key: 'published', label: 'Published Only', icon: Eye },
        { key: 'unpublished', label: 'Unpublished Only', icon: EyeOff },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <PieChart className="h-8 w-8 text-primary" />
                        Question Analytics
                    </h1>
                    <p className="text-muted-foreground">
                        Deep dive into premium coverage, tags, categories, and question types
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">Scope</p>
                    <div className="flex items-center gap-2">
                        {publishFilterOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                                <Button
                                    key={option.key}
                                    variant={publishFilter === option.key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPublishFilter(option.key)}
                                    className="gap-2"
                                >
                                    <Icon className="h-4 w-4" />
                                    {option.label}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-20" />
                        ) : (
                            <div className="text-2xl font-bold">
                                {stats.totalQuestions.toLocaleString()}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Premium Questions</CardTitle>
                        <Crown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-20" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {stats.premiumQuestions.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {premiumPercent}% of all questions
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Free Questions</CardTitle>
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-20" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {stats.freeQuestions.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {freePercent}% of all questions
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tagged Questions</CardTitle>
                        <Tag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-20" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {stats.taggedQuestions.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {taggedPercent}% of all questions
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Premium vs Free</CardTitle>
                        <CardDescription>
                            Question count split by pack premium status
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-[300px] w-full" />
                        ) : stats.totalQuestions === 0 ? (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No question data available yet
                            </div>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPieChart>
                                        <Pie
                                            data={premiumBreakdown}
                                            dataKey="value"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            label={({ name, percent }) =>
                                                `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                                            }
                                        >
                                            {premiumBreakdown.map((entry, index) => (
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

            <Card>
                <CardHeader>
                    <CardTitle>Question Types</CardTitle>
                    <CardDescription>
                        Distribution of questions by answer format
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-[240px] w-full" />
                    ) : stats.totalQuestions === 0 ? (
                        <div className="flex items-center justify-center h-[240px] text-muted-foreground">
                            No question data available yet
                        </div>
                    ) : (
                        <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={questionTypeBreakdown}>
                                    <XAxis
                                        dataKey="name"
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
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                        {questionTypeBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Tag Breakdown</CardTitle>
                        <CardDescription>
                            Tags are derived from pack topics; questions in multi-tag packs count toward each tag
                        </CardDescription>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                        <div className="flex items-center gap-2">
                            {segmentOptions.map((option) => (
                                <Button
                                    key={option.key}
                                    variant={tagSegment === option.key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTagSegment(option.key)}
                                    className="rounded-full"
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {segmentLabelByKey[tagSegment]}: {totalBySegment[tagSegment].toLocaleString()} questions ({segmentShareByKey[tagSegment]}%)
                        </p>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className="h-14 w-full" />
                            ))}
                        </div>
                    ) : totalBySegment[tagSegment] === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No questions in this segment yet
                        </div>
                    ) : tagData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No tag data available yet
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tagData.map((item) => {
                                const percentage = formatPercent(item.count, totalBySegment[tagSegment]);
                                return (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-4 rounded-lg border px-4 py-3"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium">{item.name}</p>
                                                <span className="text-sm text-muted-foreground">
                                                    {item.count.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary/70"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-12 text-right text-sm text-muted-foreground">
                                            {percentage}%
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Category Breakdown</CardTitle>
                            <CardDescription>
                                Distribution of questions across pack categories
                            </CardDescription>
                        </div>
                        <div className="flex flex-col items-start gap-1 sm:items-end">
                            <div className="flex items-center gap-2">
                                {segmentOptions.map((option) => (
                                    <Button
                                        key={option.key}
                                        variant={categorySegment === option.key ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setCategorySegment(option.key)}
                                        className="rounded-full"
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {segmentLabelByKey[categorySegment]}: {totalBySegment[categorySegment].toLocaleString()} questions ({segmentShareByKey[categorySegment]}%)
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Skeleton key={index} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : totalBySegment[categorySegment] === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No questions in this segment yet
                            </div>
                        ) : categoryData.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No category data available yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {categoryData.map((item) => {
                                    const percentage = formatPercent(item.count, totalBySegment[categorySegment]);
                                    return (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between rounded-lg border px-4 py-3"
                                        >
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">{percentage}% of questions</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-semibold">{item.count.toLocaleString()}</p>
                                                <p className="text-xs text-muted-foreground">questions</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Top Packs</CardTitle>
                            <CardDescription>
                                Packs with the most questions right now
                            </CardDescription>
                        </div>
                        <div className="flex flex-col items-start gap-1 sm:items-end">
                            <div className="flex items-center gap-2">
                                {segmentOptions.map((option) => (
                                    <Button
                                        key={option.key}
                                        variant={packSegment === option.key ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setPackSegment(option.key)}
                                        className="rounded-full"
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {segmentLabelByKey[packSegment]}: {totalBySegment[packSegment].toLocaleString()} questions ({segmentShareByKey[packSegment]}%)
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Skeleton key={index} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : totalBySegment[packSegment] === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No questions in this segment yet
                            </div>
                        ) : packData.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No pack data available yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {packData.slice(0, 8).map((pack) => (
                                    <div
                                        key={pack.id}
                                        className="flex items-center justify-between rounded-lg border px-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{pack.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{pack.category}</span>
                                                {pack.isPremium && (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        Premium
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold">{pack.count.toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground">questions</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
