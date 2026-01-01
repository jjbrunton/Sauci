import { Bot } from 'lucide-react';
import type { GeneratedPack } from '@/lib/openai';

// =============================================================================
// Types
// =============================================================================

interface PackPreviewProps {
    pack: GeneratedPack;
    sourceModel: string | null;
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

export function PackPreview({ pack, sourceModel }: PackPreviewProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">Generated Pack</h4>
                {sourceModel && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        {formatModelName(sourceModel)}
                    </span>
                )}
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-2">
                <p className="font-semibold text-lg">{pack.name}</p>
                <p className="text-muted-foreground">{pack.description}</p>
            </div>
        </div>
    );
}
