import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import type { GeneratedCategoryIdea, GeneratedPackIdea } from '@/lib/openai';

// =============================================================================
// Types
// =============================================================================

interface IdeasListProps<T extends GeneratedCategoryIdea | GeneratedPackIdea> {
    title: string;
    ideas: T[];
    sourceModel: string | null;
    onSelectIdea: (idea: T) => void;
}

// =============================================================================
// Helper
// =============================================================================

function formatModelName(model: string): string {
    const parts = model.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : model;
}

// =============================================================================
// Component
// =============================================================================

export function IdeasList<T extends GeneratedCategoryIdea | GeneratedPackIdea>({
    title,
    ideas,
    sourceModel,
    onSelectIdea,
}: IdeasListProps<T>) {
    if (ideas.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">{title}</h4>
                {sourceModel && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        {formatModelName(sourceModel)}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-1 gap-2">
                {ideas.map((idea, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => onSelectIdea(idea)}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{idea.icon}</span>
                            <div>
                                <span className="font-medium block">{idea.name}</span>
                                <span className="text-xs text-muted-foreground">{idea.description}</span>
                            </div>
                        </div>
                        <Button size="sm" variant="ghost">Use</Button>
                    </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">Click an item to use it</p>
        </div>
    );
}

// =============================================================================
// Specialized Exports (type-safe wrappers)
// =============================================================================

interface CategoryIdeasListProps {
    ideas: GeneratedCategoryIdea[];
    sourceModel: string | null;
    onSelectIdea: (idea: GeneratedCategoryIdea) => void;
}

export function CategoryIdeasList({ ideas, sourceModel, onSelectIdea }: CategoryIdeasListProps) {
    return (
        <IdeasList
            title="Suggested Categories"
            ideas={ideas}
            sourceModel={sourceModel}
            onSelectIdea={onSelectIdea}
        />
    );
}

interface PackIdeasListProps {
    ideas: GeneratedPackIdea[];
    sourceModel: string | null;
    onSelectIdea: (idea: GeneratedPackIdea) => void;
}

export function PackIdeasList({ ideas, sourceModel, onSelectIdea }: PackIdeasListProps) {
    return (
        <IdeasList
            title="Suggested Packs"
            ideas={ideas}
            sourceModel={sourceModel}
            onSelectIdea={onSelectIdea}
        />
    );
}
