import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { GenerationProgress, CouncilConfig } from '@/lib/openai';

// =============================================================================
// Types
// =============================================================================

interface GenerationProgressDisplayProps {
    progress: GenerationProgress;
    councilConfig: CouncilConfig;
}

// =============================================================================
// Component
// =============================================================================

export function GenerationProgressDisplay({
    progress,
    councilConfig,
}: GenerationProgressDisplayProps) {
    if (!councilConfig.enabled) {
        return null;
    }

    return (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            {/* Phase indicator */}
            <div className="flex items-center gap-2 text-sm font-medium">
                <span className={progress.phase === 'generating' ? 'text-primary' : 'text-muted-foreground'}>
                    Step 1: Generate
                </span>
                <span className="text-muted-foreground">→</span>
                <span className={progress.phase === 'reviewing' ? 'text-primary' : 'text-muted-foreground'}>
                    Step 2: Review
                </span>
            </div>

            {/* Generator statuses */}
            <div className="space-y-1">
                {progress.generators.map((gen, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        {gen.status === 'pending' && (
                            <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                        )}
                        {gen.status === 'generating' && (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                        {gen.status === 'completed' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {gen.status === 'failed' && (
                            <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={
                            gen.status === 'completed'
                                ? 'text-green-600 dark:text-green-400'
                                : gen.status === 'failed'
                                    ? 'text-red-600'
                                    : ''
                        }>
                            {gen.shortName}
                        </span>
                        {gen.status === 'completed' && gen.questionCount !== undefined && (
                            <span className="text-muted-foreground">
                                ({gen.questionCount} questions in {((gen.timeMs || 0) / 1000).toFixed(1)}s)
                            </span>
                        )}
                        {gen.status === 'failed' && (
                            <span className="text-red-500">failed</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Reviewer status */}
            {progress.reviewer && (
                <div className="flex items-center gap-2 text-xs pt-1 border-t border-muted-foreground/20">
                    {progress.reviewer.status === 'pending' && (
                        <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                    )}
                    {progress.reviewer.status === 'reviewing' && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    {progress.reviewer.status === 'completed' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <span className={
                        progress.reviewer.status === 'reviewing'
                            ? 'text-primary'
                            : progress.reviewer.status === 'completed'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-muted-foreground'
                    }>
                        Reviewer: {progress.reviewer.shortName}
                    </span>
                    {progress.reviewer.status === 'reviewing' && (
                        <span className="text-muted-foreground">(selecting best questions...)</span>
                    )}
                </div>
            )}
        </div>
    );
}
