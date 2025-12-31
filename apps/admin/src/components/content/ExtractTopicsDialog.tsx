import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Tags, Check, Plus, X } from 'lucide-react';
import { extractTopicsFromPack, ExtractedTopic } from '@/lib/openai';
import { supabase } from '@/config';
import { toast } from 'sonner';

interface ExtractTopicsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pack: {
        id: string;
        name: string;
        description: string | null;
    };
    onUpdated: () => void;
}

export function ExtractTopicsDialog({ open, onOpenChange, pack, onUpdated }: ExtractTopicsDialogProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [topics, setTopics] = useState<ExtractedTopic[]>([]);
    const [reasoning, setReasoning] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
    const [step, setStep] = useState<'initial' | 'review'>('initial');
    const [applying, setApplying] = useState(false);

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            // Fetch questions for this pack
            const { data: questions, error: questionsError } = await supabase
                .from('questions')
                .select('text')
                .eq('pack_id', pack.id);

            if (questionsError) throw questionsError;

            if (!questions || questions.length === 0) {
                toast.error('This pack has no questions to analyze');
                return;
            }

            // Fetch existing topics
            const { data: existingTopics, error: topicsError } = await supabase
                .from('topics')
                .select('id, name')
                .order('name');

            if (topicsError) throw topicsError;

            const result = await extractTopicsFromPack(
                pack.name,
                pack.description,
                questions.map(q => q.text),
                existingTopics || []
            );

            setTopics(result.topics);
            setReasoning(result.reasoning);
            // Default select all
            setSelectedTopics(new Set(result.topics.map(t => t.name)));
            setStep('review');
        } catch (error) {
            console.error(error);
            toast.error('Failed to analyze pack');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleApply = async () => {
        setApplying(true);
        try {
            const selectedList = topics.filter(t => selectedTopics.has(t.name));
            if (selectedList.length === 0) {
                onOpenChange(false);
                return;
            }

            // First, create any new topics
            const newTopics = selectedList.filter(t => t.isNew);
            const existingTopicIds: string[] = selectedList
                .filter(t => !t.isNew && t.existingTopicId)
                .map(t => t.existingTopicId!);

            if (newTopics.length > 0) {
                const { data: createdTopics, error: createError } = await supabase
                    .from('topics')
                    .insert(newTopics.map(t => ({ name: t.name })))
                    .select('id');

                if (createError) throw createError;

                if (createdTopics) {
                    existingTopicIds.push(...createdTopics.map(t => t.id));
                }
            }

            // Remove existing pack_topics for this pack
            await supabase
                .from('pack_topics')
                .delete()
                .eq('pack_id', pack.id);

            // Insert new pack_topics relationships
            if (existingTopicIds.length > 0) {
                const { error: linkError } = await supabase
                    .from('pack_topics')
                    .insert(existingTopicIds.map(topicId => ({
                        pack_id: pack.id,
                        topic_id: topicId,
                    })));

                if (linkError) throw linkError;
            }

            toast.success(`Added ${selectedList.length} topic${selectedList.length !== 1 ? 's' : ''} to pack`);
            onUpdated();
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error('Failed to apply topics');
        } finally {
            setApplying(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset state after transition
        setTimeout(() => {
            setStep('initial');
            setTopics([]);
            setReasoning('');
            setSelectedTopics(new Set());
        }, 300);
    };

    const toggleSelection = (name: string) => {
        const next = new Set(selectedTopics);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedTopics(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tags className="h-5 w-5 text-blue-500" />
                        Extract Topics
                    </DialogTitle>
                    <DialogDescription>
                        Use AI to identify topics and kinks for "{pack.name}"
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {step === 'initial' ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="bg-blue-500/20 p-4 rounded-full">
                                <Tags className="h-12 w-12 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">Analyze pack for topics</h3>
                                <p className="text-muted-foreground max-w-md mx-auto">
                                    The AI will analyze the questions in this pack and suggest relevant topics
                                    like bondage, exhibitionism, romance, etc. It will prefer matching existing
                                    topics when possible.
                                </p>
                            </div>
                            <Button onClick={handleAnalyze} disabled={analyzing} size="lg" className="bg-blue-600 hover:bg-blue-700">
                                {analyzing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    'Start Analysis'
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {topics.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <X className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                                    No topics could be identified for this pack.
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium">Suggested Topics</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {topics.map((topic) => (
                                                <Badge
                                                    key={topic.name}
                                                    variant={selectedTopics.has(topic.name) ? 'default' : 'outline'}
                                                    className={`cursor-pointer text-sm py-1.5 px-3 ${
                                                        selectedTopics.has(topic.name)
                                                            ? topic.isNew
                                                                ? 'bg-green-600 hover:bg-green-700'
                                                                : 'bg-blue-600 hover:bg-blue-700'
                                                            : 'hover:bg-muted'
                                                    }`}
                                                    onClick={() => toggleSelection(topic.name)}
                                                >
                                                    {selectedTopics.has(topic.name) ? (
                                                        <Check className="h-3 w-3 mr-1" />
                                                    ) : null}
                                                    {topic.name}
                                                    {topic.isNew && (
                                                        <Plus className="h-3 w-3 ml-1" />
                                                    )}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded bg-blue-600" />
                                                Existing topic
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded bg-green-600" />
                                                <Plus className="h-3 w-3" />
                                                New topic
                                            </span>
                                        </div>
                                    </div>

                                    {reasoning && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium">AI Reasoning</h4>
                                            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                                                {reasoning}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 'review' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('initial')}>
                                Back
                            </Button>
                            <Button
                                onClick={handleApply}
                                disabled={applying || topics.length === 0 || selectedTopics.size === 0}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {applying ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Applying...
                                    </>
                                ) : (
                                    `Apply ${selectedTopics.size} Topic${selectedTopics.size !== 1 ? 's' : ''}`
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
