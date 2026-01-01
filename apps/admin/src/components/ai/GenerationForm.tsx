import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { TONE_LEVELS, type ToneLevel } from '@/lib/openai';
import type { GeneratorType, GeneratorContext, GenerationConfig } from './hooks/useAiGeneration';

// =============================================================================
// Types
// =============================================================================

interface GenerationFormProps {
    type: GeneratorType;
    context?: GeneratorContext;
    config: GenerationConfig;
    onCountChange: (count: number) => void;
    onToneChange: (tone: ToneLevel) => void;
    onCrudeLangChange: (crudeLang: boolean) => void;
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
    onToneChange,
    onCrudeLangChange,
    onInspirationChange,
}: GenerationFormProps) {
    const isExplicit = config.tone >= 4;

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

            {/* Wildness Level Selector (questions only) */}
            {type === 'questions' && (
                <div className="space-y-2">
                    <Label>Wildness Level</Label>
                    <div className="flex flex-wrap gap-2">
                        {TONE_LEVELS.map((t) => (
                            <Button
                                key={t.level}
                                type="button"
                                variant={config.tone === t.level ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onToneChange(t.level as ToneLevel)}
                                className={config.tone === t.level ? 'ring-2 ring-offset-1' : ''}
                                title={t.description}
                            >
                                {t.level}. {t.label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {TONE_LEVELS.find(t => t.level === config.tone)?.description}
                    </p>
                </div>
            )}

            {/* Wild/Explicit Toggle (for other generators) */}
            {(type === 'category-ideas' || type === 'category-pack-ideas' || type === 'pack') && (
                <div className="flex items-center space-x-2">
                    <Switch
                        id="explicit-mode"
                        checked={isExplicit}
                        onCheckedChange={(checked: boolean) => onToneChange(checked ? 5 : 3)}
                    />
                    <Label htmlFor="explicit-mode">Include Wild/Adult Ideas</Label>
                </div>
            )}

            {/* Crude Language Override Toggle */}
            <div className="flex items-center space-x-2">
                <Switch
                    id="crude-lang"
                    checked={config.crudeLang}
                    onCheckedChange={onCrudeLangChange}
                />
                <Label htmlFor="crude-lang">Crude Language Override</Label>
                <span className="text-xs text-muted-foreground">
                    (use "fuck", "suck cock" etc. instead of tasteful phrasing)
                </span>
            </div>

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
