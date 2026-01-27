import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { GeneratorType, GeneratorContext, GenerationConfig } from './hooks/useAiGeneration';

// =============================================================================
// Types
// =============================================================================

interface GenerationFormProps {
    type: GeneratorType;
    context?: GeneratorContext;
    config: GenerationConfig;
    onCountChange: (count: number) => void;
    onInspirationChange: (inspiration: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function GenerationForm({
    type,
    context,
    config,
    onCountChange,
    onInspirationChange,
}: GenerationFormProps) {
    return (
        <div className="space-y-4">
            {/* Question Count (questions only) */}
            {type === 'questions' && (
                <div className="space-y-2">
                    <Label htmlFor="count">Number of Questions</Label>
                    <Input
                        id="count"
                        type="number"
                        min={1}
                        max={50}
                        value={config.count}
                        onChange={(e) => onCountChange(parseInt(e.target.value) || 10)}
                        className="w-32"
                    />
                </div>
            )}

            {/* Inspiration/Suggestions Textarea */}
            <div className="space-y-2">
                <Label htmlFor="inspiration">Inspiration / Suggestions (optional)</Label>
                <Textarea
                    id="inspiration"
                    placeholder="Provide any themes, ideas, or guidance for the AI to consider..."
                    value={config.inspiration}
                    onChange={(e) => onInspirationChange(e.target.value)}
                    rows={3}
                    className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                    Add freetext suggestions to guide the AI generation
                </p>
            </div>

            {/* Context info */}
            {context?.categoryName && (
                <div className="rounded-md bg-muted p-3 text-sm">
                    <strong>Category:</strong> {context.categoryName}
                </div>
            )}
            {context?.packName && (
                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <div><strong>Pack:</strong> {context.packName}</div>
                    {context.packDescription && (
                        <div className="text-muted-foreground text-xs">{context.packDescription}</div>
                    )}
                </div>
            )}
        </div>
    );
}
