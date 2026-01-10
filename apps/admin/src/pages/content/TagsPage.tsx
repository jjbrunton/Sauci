import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Sparkles, Tags } from 'lucide-react';
import { extractTopicsFromPack } from '@/lib/openai';

interface TopicRow {
    id: string;
    name: string;
}

interface PackTopicRow {
    pack_id: string;
    topic_id: string;
}

interface PackRow {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    category?: { name: string } | { name: string }[] | null;
}

interface ActiveTag {
    id: string;
    name: string;
    packCount: number;
}

interface UntaggedPack {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    categoryName: string;
    questionCount: number;
}

const getCategoryName = (category?: PackRow['category']) => {
    if (!category) return 'Uncategorized';
    if (Array.isArray(category)) {
        return category[0]?.name || 'Uncategorized';
    }
    return category.name || 'Uncategorized';
};

export function TagsPage() {
    const [activeTags, setActiveTags] = useState<ActiveTag[]>([]);
    const [untaggedPacks, setUntaggedPacks] = useState<UntaggedPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [taggingAll, setTaggingAll] = useState(false);
    const [taggingProgress, setTaggingProgress] = useState<{
        current: number;
        total: number;
        packName: string;
    } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [topicsResult, packTopicsResult, packsResult] = await Promise.all([
                supabase.from('topics').select('id, name').order('name'),
                supabase.from('pack_topics').select('pack_id, topic_id'),
                supabase
                    .from('question_packs')
                    .select('id, name, description, is_public, category:categories(name)')
                    .order('name'),
            ]);

            if (topicsResult.error) throw topicsResult.error;
            if (packTopicsResult.error) throw packTopicsResult.error;
            if (packsResult.error) throw packsResult.error;

            const topics = (topicsResult.data || []) as TopicRow[];
            const packTopics = (packTopicsResult.data || []) as PackTopicRow[];
            const packs = (packsResult.data || []) as PackRow[];

            const topicCounts = new Map<string, number>();
            const packIdsWithTopics = new Set<string>();

            packTopics.forEach((relation) => {
                if (!relation.topic_id || !relation.pack_id) return;
                packIdsWithTopics.add(relation.pack_id);
                topicCounts.set(relation.topic_id, (topicCounts.get(relation.topic_id) || 0) + 1);
            });

            const activeTagList = topics
                .filter((topic) => topicCounts.has(topic.id))
                .map((topic) => ({
                    id: topic.id,
                    name: topic.name,
                    packCount: topicCounts.get(topic.id) || 0,
                }))
                .sort((a, b) => {
                    if (b.packCount !== a.packCount) return b.packCount - a.packCount;
                    return a.name.localeCompare(b.name);
                });

            const untagged = packs.filter((pack) => !packIdsWithTopics.has(pack.id));
            const untaggedPackIds = untagged.map((pack) => pack.id);
            const questionCounts: Record<string, number> = {};

            if (untaggedPackIds.length > 0) {
                const { data: questions, error: questionsError } = await supabase
                    .from('questions')
                    .select('pack_id')
                    .in('pack_id', untaggedPackIds);

                if (questionsError) throw questionsError;

                questions?.forEach((question) => {
                    if (!question.pack_id) return;
                    questionCounts[question.pack_id] = (questionCounts[question.pack_id] || 0) + 1;
                });
            }

            setActiveTags(activeTagList);
            setUntaggedPacks(
                untagged.map((pack) => ({
                    id: pack.id,
                    name: pack.name,
                    description: pack.description,
                    is_public: pack.is_public,
                    categoryName: getCategoryName(pack.category),
                    questionCount: questionCounts[pack.id] || 0,
                }))
            );
        } catch (error) {
            toast.error('Failed to load tags');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const eligiblePackCount = untaggedPacks.filter((pack) => pack.questionCount > 0).length;

    const handleTagAll = async () => {
        if (taggingAll || eligiblePackCount === 0) return;

        const eligiblePacks = untaggedPacks.filter((pack) => pack.questionCount > 0);
        const skippedNoQuestions = untaggedPacks.length - eligiblePacks.length;

        if (eligiblePacks.length === 0) {
            toast('No untagged packs with questions to tag');
            return;
        }

        const shouldProceed = confirm(
            `Tag ${eligiblePacks.length} untagged pack${eligiblePacks.length !== 1 ? 's' : ''} with AI?` +
                (skippedNoQuestions > 0
                    ? ` ${skippedNoQuestions} pack${skippedNoQuestions !== 1 ? 's' : ''} without questions will be skipped.`
                    : '')
        );
        if (!shouldProceed) return;

        setTaggingAll(true);
        setTaggingProgress({ current: 0, total: eligiblePacks.length, packName: '' });

        try {
            const { data: topicsData, error: topicsError } = await supabase
                .from('topics')
                .select('id, name')
                .order('name');

            if (topicsError) throw topicsError;

            const existingTopics: TopicRow[] = [...(topicsData || [])];
            let taggedCount = 0;
            let skippedCount = 0;
            let failedCount = 0;

            for (let index = 0; index < eligiblePacks.length; index += 1) {
                const pack = eligiblePacks[index];
                setTaggingProgress({
                    current: index + 1,
                    total: eligiblePacks.length,
                    packName: pack.name,
                });

                try {
                    const { data: questions, error: questionsError } = await supabase
                        .from('questions')
                        .select('text')
                        .eq('pack_id', pack.id);

                    if (questionsError) throw questionsError;

                    if (!questions || questions.length === 0) {
                        skippedCount += 1;
                        continue;
                    }

                    const result = await extractTopicsFromPack(
                        pack.name,
                        pack.description,
                        questions.map((question) => question.text),
                        existingTopics
                    );

                    if (!result.topics || result.topics.length === 0) {
                        skippedCount += 1;
                        continue;
                    }

                    const existingByName = new Map(
                        existingTopics.map((topic) => [topic.name.toLowerCase(), topic.id])
                    );
                    const newTopics: { name: string }[] = [];
                    const topicIds: string[] = [];

                    result.topics.forEach((topic) => {
                        const normalizedName = topic.name.trim();
                        if (!normalizedName) return;

                        if (!topic.isNew && topic.existingTopicId) {
                            topicIds.push(topic.existingTopicId);
                            return;
                        }

                        const existingId = existingByName.get(normalizedName.toLowerCase());
                        if (existingId) {
                            topicIds.push(existingId);
                            return;
                        }

                        newTopics.push({ name: normalizedName });
                    });

                    if (newTopics.length > 0) {
                        const { data: createdTopics, error: createError } = await supabase
                            .from('topics')
                            .insert(newTopics)
                            .select('id, name');

                        if (createError) throw createError;

                        createdTopics?.forEach((topic) => {
                            topicIds.push(topic.id);
                            existingTopics.push({ id: topic.id, name: topic.name });
                        });
                    }

                    await supabase.from('pack_topics').delete().eq('pack_id', pack.id);

                    if (topicIds.length === 0) {
                        skippedCount += 1;
                        continue;
                    }

                    const { error: linkError } = await supabase
                        .from('pack_topics')
                        .insert(topicIds.map((topicId) => ({
                            pack_id: pack.id,
                            topic_id: topicId,
                        })));

                    if (linkError) throw linkError;

                    taggedCount += 1;
                } catch (error) {
                    failedCount += 1;
                    console.error(`Failed to tag pack ${pack.name}:`, error);
                }
            }

            if (failedCount > 0) {
                toast.error(`Tagged ${taggedCount} pack${taggedCount !== 1 ? 's' : ''}. ${failedCount} failed.`);
            } else {
                toast.success(
                    `Tagged ${taggedCount} pack${taggedCount !== 1 ? 's' : ''}.` +
                        (skippedCount > 0 ? ` ${skippedCount} skipped.` : '')
                );
            }
        } catch (error) {
            toast.error('Failed to tag all packs');
            console.error(error);
        } finally {
            setTaggingAll(false);
            setTaggingProgress(null);
            fetchData();
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Tags className="h-8 w-8 text-primary" />
                        Tags
                    </h1>
                    <p className="text-muted-foreground">
                        Active tags and packs that still need topic coverage
                    </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Button
                        onClick={handleTagAll}
                        disabled={taggingAll || eligiblePackCount === 0}
                    >
                        {taggingAll ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {taggingAll && taggingProgress
                            ? `Tagging ${taggingProgress.current}/${taggingProgress.total}`
                            : 'Tag All Untagged'}
                    </Button>
                    {taggingProgress?.packName && (
                        <p className="text-xs text-muted-foreground">
                            Working on {taggingProgress.packName}
                        </p>
                    )}
                    {eligiblePackCount === 0 && untaggedPacks.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Add questions to enable auto-tagging.
                        </p>
                    )}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Tags</CardTitle>
                        <Tags className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeTags.length.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Tags assigned to at least one pack</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Untagged Packs</CardTitle>
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{untaggedPacks.length.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Packs missing any tag coverage</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Active Tags</CardTitle>
                        <CardDescription>Tag usage across question packs</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activeTags.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <CheckCircle2 className="h-10 w-10 mb-2" />
                                No active tags yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeTags.map((tag) => (
                                    <div
                                        key={tag.id}
                                        className="flex items-center justify-between rounded-lg border px-4 py-3"
                                    >
                                        <p className="font-medium">{tag.name}</p>
                                        <Badge variant="secondary">
                                            {tag.packCount} pack{tag.packCount !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Untagged Packs</CardTitle>
                            <CardDescription>These packs still need topics</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs">
                            {untaggedPacks.length} total
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        {untaggedPacks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <CheckCircle2 className="h-10 w-10 mb-2" />
                                All packs are tagged
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {untaggedPacks.map((pack) => (
                                    <div
                                        key={pack.id}
                                        className="flex items-center justify-between rounded-lg border px-4 py-3"
                                    >
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium">{pack.name}</p>
                                                {pack.is_public ? (
                                                    <Badge variant="outline" className="border-green-500 text-green-400">
                                                        Published
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">Draft</Badge>
                                                )}
                                                {pack.questionCount === 0 && (
                                                    <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                                                        No questions
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{pack.categoryName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold">{pack.questionCount}</p>
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
