import { useState, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { useAiConfig, AiConfig, CouncilGenerator } from '@/hooks/useAiConfig';
import { useAuth, PERMISSION_KEYS } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Eye, EyeOff, AlertTriangle, Bot, Sparkles, RefreshCw, Plus, Trash2, Package, Cherry, Shield, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ModelCombobox } from '@/components/ModelCombobox';

type ListField = 'heuristic_whitelist' | 'heuristic_keyword_triggers';

const parseListValue = (value?: string | null): string[] => {
    if (!value) return [];
    return value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const appendUniqueItem = (items: string[], value: string): string[] => {
    const trimmed = value.trim();
    if (!trimmed) return items;
    const existing = new Set(items.map((item) => item.toLowerCase()));
    if (existing.has(trimmed.toLowerCase())) return items;
    return [...items, trimmed];
};

const removeItem = (items: string[], value: string): string[] => {
    const target = value.toLowerCase();
    return items.filter((item) => item.toLowerCase() !== target);
};

export function AiSettingsPage() {
    const { hasPermission, isSuperAdmin } = useAuth();
    const { config, loading, error, updateConfig, refetch } = useAiConfig();

    // Local form state
    const [formData, setFormData] = useState<Partial<AiConfig>>({});
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [whitelistInput, setWhitelistInput] = useState('');
    const [keywordInput, setKeywordInput] = useState('');

    // Permission check - only super admins or those with MANAGE_AI_CONFIG can access
    const canManage = isSuperAdmin || hasPermission(PERMISSION_KEYS.MANAGE_AI_CONFIG);

    // Initialize form data when config loads
    useEffect(() => {
        if (config) {
            // Handle generators array - default to one generator with the legacy model or default
            const generators: CouncilGenerator[] = config.council_generators && config.council_generators.length > 0
                ? config.council_generators
                : [{ model: config.council_generator_model || 'anthropic/claude-3.5-sonnet' }];

            setFormData({
                openrouter_api_key: config.openrouter_api_key || '',
                default_model: config.default_model || '',
                default_temperature: config.default_temperature,
                model_generate: config.model_generate || '',
                temperature_generate: config.temperature_generate,
                model_fix: config.model_fix || '',
                temperature_fix: config.temperature_fix,
                model_polish: config.model_polish || '',
                temperature_polish: config.temperature_polish,
                council_enabled: config.council_enabled || false,
                council_generator_model: config.council_generator_model || '',
                council_generators: generators,
                council_reviewer_model: config.council_reviewer_model || '',
                council_reviewer_temperature: config.council_reviewer_temperature,
                council_selection_mode: config.council_selection_mode || 'whole_set',
                cherry_pick_ensure_intensity_distribution: config.cherry_pick_ensure_intensity_distribution ?? true,
                classifier_enabled: config.classifier_enabled ?? true,
                classifier_model: config.classifier_model || 'openai/gpt-4o',
                classifier_temperature: config.classifier_temperature,
                classifier_prompt: config.classifier_prompt || '',
                heuristics_enabled: config.heuristics_enabled ?? false,
                heuristic_min_text_length: config.heuristic_min_text_length ?? 12,
                heuristic_whitelist_max_length: config.heuristic_whitelist_max_length ?? 30,
                heuristic_skip_if_no_alnum: config.heuristic_skip_if_no_alnum ?? true,
                heuristic_skip_media_without_text: config.heuristic_skip_media_without_text ?? false,
                heuristic_record_reason: config.heuristic_record_reason ?? false,
                heuristic_use_default_whitelist: config.heuristic_use_default_whitelist ?? true,
                heuristic_use_default_keywords: config.heuristic_use_default_keywords ?? true,
                heuristic_whitelist: config.heuristic_whitelist || '',
                heuristic_keyword_triggers: config.heuristic_keyword_triggers || '',
            });
            setHasChanges(false);
        }
    }, [config]);

    const handleChange = <K extends keyof AiConfig>(field: K, value: AiConfig[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const whitelistItems = parseListValue(formData.heuristic_whitelist ?? '');
    const keywordItems = parseListValue(formData.heuristic_keyword_triggers ?? '');

    const updateListField = (field: ListField, items: string[]) => {
        handleChange(field, items.length > 0 ? items.join('\n') : '');
    };

    const handleAddListItem = (
        field: ListField,
        value: string,
        clearValue: (next: string) => void
    ) => {
        const current = field === 'heuristic_whitelist' ? whitelistItems : keywordItems;
        const nextItems = appendUniqueItem(current, value);
        if (nextItems !== current) {
            updateListField(field, nextItems);
        }
        if (value.trim()) {
            clearValue('');
        }
    };

    const handleRemoveListItem = (field: ListField, value: string) => {
        const current = field === 'heuristic_whitelist' ? whitelistItems : keywordItems;
        const nextItems = removeItem(current, value);
        updateListField(field, nextItems);
    };

    const handleListKeyDown = (
        event: KeyboardEvent<HTMLInputElement>,
        field: ListField,
        value: string,
        clearValue: (next: string) => void
    ) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddListItem(field, value, clearValue);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error: saveError } = await updateConfig(formData);
            if (saveError) {
                toast.error(saveError);
            } else {
                toast.success('AI settings saved successfully');
                setHasChanges(false);
            }
        } catch {
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (config) {
            const generators: CouncilGenerator[] = config.council_generators && config.council_generators.length > 0
                ? config.council_generators
                : [{ model: config.council_generator_model || 'anthropic/claude-3.5-sonnet' }];

            setFormData({
                openrouter_api_key: config.openrouter_api_key || '',
                default_model: config.default_model || '',
                default_temperature: config.default_temperature,
                model_generate: config.model_generate || '',
                temperature_generate: config.temperature_generate,
                model_fix: config.model_fix || '',
                temperature_fix: config.temperature_fix,
                model_polish: config.model_polish || '',
                temperature_polish: config.temperature_polish,
                council_enabled: config.council_enabled || false,
                council_generator_model: config.council_generator_model || '',
                council_generators: generators,
                council_reviewer_model: config.council_reviewer_model || '',
                council_reviewer_temperature: config.council_reviewer_temperature,
                council_selection_mode: config.council_selection_mode || 'whole_set',
                cherry_pick_ensure_intensity_distribution: config.cherry_pick_ensure_intensity_distribution ?? true,
                classifier_enabled: config.classifier_enabled ?? true,
                classifier_model: config.classifier_model || 'openai/gpt-4o',
                classifier_temperature: config.classifier_temperature,
                classifier_prompt: config.classifier_prompt || '',
                heuristics_enabled: config.heuristics_enabled ?? false,
                heuristic_min_text_length: config.heuristic_min_text_length ?? 12,
                heuristic_whitelist_max_length: config.heuristic_whitelist_max_length ?? 30,
                heuristic_skip_if_no_alnum: config.heuristic_skip_if_no_alnum ?? true,
                heuristic_skip_media_without_text: config.heuristic_skip_media_without_text ?? false,
                heuristic_record_reason: config.heuristic_record_reason ?? false,
                heuristic_use_default_whitelist: config.heuristic_use_default_whitelist ?? true,
                heuristic_use_default_keywords: config.heuristic_use_default_keywords ?? true,
                heuristic_whitelist: config.heuristic_whitelist || '',
                heuristic_keyword_triggers: config.heuristic_keyword_triggers || '',
            });
            setHasChanges(false);
        }
    };

    // Helper functions for managing generators array
    const generators = (formData.council_generators as CouncilGenerator[]) || [{ model: 'anthropic/claude-3.5-sonnet' }];

    const addGenerator = () => {
        const newGenerators = [...generators, { model: '' }];
        handleChange('council_generators', newGenerators);
    };

    const removeGenerator = (index: number) => {
        if (generators.length <= 1) {
            toast.error('You must have at least one generator');
            return;
        }
        const newGenerators = generators.filter((_, i) => i !== index);
        handleChange('council_generators', newGenerators);
    };

    const updateGenerator = (index: number, updates: Partial<CouncilGenerator>) => {
        const newGenerators = generators.map((g, i) => i === index ? { ...g, ...updates } : g);
        handleChange('council_generators', newGenerators);
    };

    if (!canManage) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You don't have permission to manage AI settings. Contact a super admin for access.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
                    <p className="text-muted-foreground">Configure AI models and API settings</p>
                </div>
                <div className="grid gap-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
                    <p className="text-muted-foreground">Configure AI models and API settings</p>
                </div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error loading settings</AlertTitle>
                    <AlertDescription className="flex items-center gap-4">
                        {error}
                        <Button variant="outline" size="sm" onClick={refetch}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
                    <p className="text-muted-foreground">
                        Configure AI models and API settings for content generation
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button variant="ghost" onClick={handleReset}>
                            Cancel
                        </Button>
                    )}
                    <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {config?.updated_at && (
                <p className="text-sm text-muted-foreground">
                    Last updated: {format(new Date(config.updated_at), 'MMM d, yyyy HH:mm')}
                </p>
            )}

            {/* API Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        API Configuration
                    </CardTitle>
                    <CardDescription>
                        Configure your OpenRouter API key for AI model access
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="api-key">OpenRouter API Key</Label>
                        <div className="relative">
                            <Input
                                id="api-key"
                                type={showApiKey ? 'text' : 'password'}
                                value={formData.openrouter_api_key || ''}
                                onChange={(e) => handleChange('openrouter_api_key', e.target.value)}
                                placeholder="sk-or-v1-..."
                                className="pr-10 font-mono"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowApiKey(!showApiKey)}
                            >
                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Get your API key from{' '}
                            <a
                                href="https://openrouter.ai/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                openrouter.ai/keys
                            </a>
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Moderation Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Moderation Settings
                    </CardTitle>
                    <CardDescription>
                        Configure automatic content moderation for messages
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Enable Auto-Moderation</Label>
                            <p className="text-xs text-muted-foreground">
                                Automatically flag illegal/dangerous content
                            </p>
                        </div>
                        <Switch
                            checked={formData.classifier_enabled ?? true}
                            onCheckedChange={(checked) => handleChange('classifier_enabled', checked)}
                        />
                    </div>

                    <div className="grid grid-cols-[1fr,120px] gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="classifier-model">Classifier Model</Label>
                            <ModelCombobox
                                value={formData.classifier_model || ''}
                                onChange={(value) => handleChange('classifier_model', value)}
                                placeholder="openai/gpt-4o"
                            />
                            <p className="text-xs text-muted-foreground">
                                Model used for classification (must support vision if image moderation is needed)
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="classifier-temperature">Temp</Label>
                            <Input
                                id="classifier-temperature"
                                type="number"
                                step="0.1"
                                min="0"
                                max="2"
                                value={formData.classifier_temperature ?? ''}
                                onChange={(e) => handleChange('classifier_temperature', e.target.value === '' ? null : Number(e.target.value))}
                                placeholder="1.0"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="classifier-prompt">System Prompt</Label>
                        <Textarea
                            id="classifier-prompt"
                            value={formData.classifier_prompt || ''}
                            onChange={(e) => handleChange('classifier_prompt', e.target.value)}
                            className="h-32 font-mono text-sm"
                            placeholder="You are a content moderator..."
                        />
                        <p className="text-xs text-muted-foreground">
                            Instructions for the AI classifier.
                        </p>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Enable Heuristic Pre-Filter</Label>
                                <p className="text-xs text-muted-foreground">
                                    Skip AI calls for low-risk messages using simple rules
                                </p>
                            </div>
                            <Switch
                                checked={formData.heuristics_enabled ?? false}
                                onCheckedChange={(checked) => handleChange('heuristics_enabled', checked)}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="heuristic-min-length">Minimum Text Length</Label>
                                <Input
                                    id="heuristic-min-length"
                                    type="number"
                                    min={0}
                                    value={formData.heuristic_min_text_length ?? 12}
                                    onChange={(e) =>
                                        handleChange(
                                            'heuristic_min_text_length',
                                            e.target.value === '' ? null : Number(e.target.value)
                                        )
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Skip AI for shorter messages without media
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="heuristic-whitelist-max">Whitelist Max Length</Label>
                                <Input
                                    id="heuristic-whitelist-max"
                                    type="number"
                                    min={0}
                                    value={formData.heuristic_whitelist_max_length ?? 30}
                                    onChange={(e) =>
                                        handleChange(
                                            'heuristic_whitelist_max_length',
                                            e.target.value === '' ? null : Number(e.target.value)
                                        )
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Only apply whitelist to messages below this length
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Skip If No Letters/Numbers</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Treat emoji-only or punctuation-only messages as safe
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.heuristic_skip_if_no_alnum ?? true}
                                    onCheckedChange={(checked) => handleChange('heuristic_skip_if_no_alnum', checked)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Skip Media Without Text</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Skip AI when only media is present
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.heuristic_skip_media_without_text ?? false}
                                    onCheckedChange={(checked) => handleChange('heuristic_skip_media_without_text', checked)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Use Default Whitelist</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Include built-in common phrases
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.heuristic_use_default_whitelist ?? true}
                                    onCheckedChange={(checked) => handleChange('heuristic_use_default_whitelist', checked)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Use Default Keywords</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Include built-in safety keywords
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.heuristic_use_default_keywords ?? true}
                                    onCheckedChange={(checked) => handleChange('heuristic_use_default_keywords', checked)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Record Heuristic Reason</Label>
                                <p className="text-xs text-muted-foreground">
                                    Store skip reason in flag_reason for debugging
                                </p>
                            </div>
                            <Switch
                                checked={formData.heuristic_record_reason ?? false}
                                onCheckedChange={(checked) => handleChange('heuristic_record_reason', checked)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Custom Whitelist</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    value={whitelistInput}
                                    onChange={(e) => setWhitelistInput(e.target.value)}
                                    onKeyDown={(event) =>
                                        handleListKeyDown(event, 'heuristic_whitelist', whitelistInput, setWhitelistInput)
                                    }
                                    placeholder="Add phrase"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        handleAddListItem('heuristic_whitelist', whitelistInput, setWhitelistInput)
                                    }
                                    disabled={!whitelistInput.trim()}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                </Button>
                            </div>
                            {whitelistItems.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {whitelistItems.map((item) => (
                                        <Badge key={item} variant="secondary" className="flex items-center gap-1">
                                            <span className="font-mono text-xs">{item}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveListItem('heuristic_whitelist', item)}
                                                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                                                aria-label={`Remove ${item}`}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No phrases added yet.</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Messages matching these phrases are marked safe
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Keyword Triggers</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={(event) =>
                                        handleListKeyDown(event, 'heuristic_keyword_triggers', keywordInput, setKeywordInput)
                                    }
                                    placeholder="Add keyword"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        handleAddListItem('heuristic_keyword_triggers', keywordInput, setKeywordInput)
                                    }
                                    disabled={!keywordInput.trim()}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                </Button>
                            </div>
                            {keywordItems.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {keywordItems.map((item) => (
                                        <Badge key={item} variant="secondary" className="flex items-center gap-1">
                                            <span className="font-mono text-xs">{item}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveListItem('heuristic_keyword_triggers', item)}
                                                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                                                aria-label={`Remove ${item}`}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No keywords added yet.</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                If any term appears, the message will be sent to AI
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Model Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Model Configuration
                    </CardTitle>
                    <CardDescription>
                        Configure which AI models to use for different tasks. Leave blank to use the default model.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-[1fr,120px] gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="default-model">Default Model</Label>
                            <ModelCombobox
                                value={formData.default_model || ''}
                                onChange={(value) => handleChange('default_model', value)}
                                placeholder="openai/gpt-4o-mini"
                            />
                            <p className="text-xs text-muted-foreground">
                                Fallback model when no specific model is configured
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="default-temperature">Temp</Label>
                            <Input
                                id="default-temperature"
                                type="number"
                                step="0.1"
                                min="0"
                                max="2"
                                value={formData.default_temperature ?? ''}
                                onChange={(e) => handleChange('default_temperature', e.target.value === '' ? null : Number(e.target.value))}
                                placeholder="0.7"
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Generation Section - changes based on council mode */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Question Generation</Label>
                                <p className="text-xs text-muted-foreground">
                                    {formData.council_enabled
                                        ? 'Multiple models generate in parallel, reviewer picks the best'
                                        : 'Single model generates content directly'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="council-toggle" className="text-xs text-muted-foreground">
                                    Council Mode
                                </Label>
                                <Switch
                                    id="council-toggle"
                                    checked={formData.council_enabled || false}
                                    onCheckedChange={(checked: boolean) => handleChange('council_enabled', checked)}
                                />
                            </div>
                        </div>

                        {!formData.council_enabled ? (
                            /* Single generator mode */
                            <div className="grid grid-cols-[1fr,120px] gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="model-generate">Generation Model</Label>
                                    <ModelCombobox
                                        value={formData.model_generate || ''}
                                        onChange={(value) => handleChange('model_generate', value)}
                                        placeholder="Uses default model"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        For questions, category ideas, and pack ideas
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="generate-temperature">Temp</Label>
                                    <Input
                                        id="generate-temperature"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        value={formData.temperature_generate ?? ''}
                                        onChange={(e) => handleChange('temperature_generate', e.target.value === '' ? null : Number(e.target.value))}
                                        placeholder="0.9"
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Council mode - multiple generators + reviewer */
                            <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                                {/* Generators */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm">Generators ({generators.length})</Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addGenerator}
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add
                                        </Button>
                                    </div>
                                    {generators.map((gen, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                {index + 1}
                                            </div>
                                            <ModelCombobox
                                                value={gen.model}
                                                onChange={(value) => updateGenerator(index, { model: value })}
                                                placeholder={index === 0 ? "anthropic/claude-3.5-sonnet" : "Select model..."}
                                                className="flex-1"
                                            />
                                            <Input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                max="2"
                                                value={gen.temperature ?? ''}
                                                onChange={(e) => updateGenerator(index, { temperature: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                placeholder="0.9"
                                                className="w-[80px]"
                                                aria-label={`Generator ${index + 1} temperature`}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeGenerator(index)}
                                                disabled={generators.length <= 1}
                                                className="text-destructive hover:text-destructive h-8 w-8"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                {/* Reviewer */}
                                <div className="grid grid-cols-[1fr,120px] gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="council-reviewer" className="text-sm">Reviewer Model</Label>
                                        <ModelCombobox
                                            value={formData.council_reviewer_model || ''}
                                            onChange={(value) => handleChange('council_reviewer_model', value)}
                                            placeholder="google/gemini-pro-1.5"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Reviews outputs and selects the best
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reviewer-temperature" className="text-sm">Temp</Label>
                                        <Input
                                            id="reviewer-temperature"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="2"
                                            value={formData.council_reviewer_temperature ?? ''}
                                            onChange={(e) => handleChange('council_reviewer_temperature', e.target.value === '' ? null : Number(e.target.value))}
                                            placeholder="0.3"
                                        />
                                    </div>
                                </div>

                                {/* Selection Mode */}
                                <div className="space-y-2">
                                    <Label className="text-sm">Selection Mode</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div
                                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                                formData.council_selection_mode === 'whole_set'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'hover:bg-accent'
                                            }`}
                                            onClick={() => handleChange('council_selection_mode', 'whole_set')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4" />
                                                <span className="text-sm font-medium">Whole Set</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Pick best complete set
                                            </p>
                                        </div>
                                        <div
                                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                                formData.council_selection_mode === 'cherry_pick'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'hover:bg-accent'
                                            }`}
                                            onClick={() => handleChange('council_selection_mode', 'cherry_pick')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Cherry className="h-4 w-4" />
                                                <span className="text-sm font-medium">Cherry Pick</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Mix best from each
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Cherry-pick intensity option */}
                                {formData.council_selection_mode === 'cherry_pick' && (
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm">Ensure Intensity Variety</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Balance across intensity levels 1-5
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formData.cherry_pick_ensure_intensity_distribution ?? true}
                                            onCheckedChange={(checked: boolean) =>
                                                handleChange('cherry_pick_ensure_intensity_distribution', checked)
                                            }
                                        />
                                    </div>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    Uses {generators.length + 1} API calls ({generators.length} generator{generators.length > 1 ? 's' : ''} + reviewer)
                                </p>
                            </div>
                        )}

                        {/* Ideas Model - shown when council mode is ON (since council only applies to questions) */}
                        {formData.council_enabled && (
                            <div className="grid grid-cols-[1fr,120px] gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="model-generate">Ideas Model</Label>
                                    <ModelCombobox
                                        value={formData.model_generate || ''}
                                        onChange={(value) => handleChange('model_generate', value)}
                                        placeholder="Uses default model"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        For category ideas and pack ideas (council mode only applies to questions)
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ideas-temperature">Temp</Label>
                                    <Input
                                        id="ideas-temperature"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        value={formData.temperature_generate ?? ''}
                                        onChange={(e) => handleChange('temperature_generate', e.target.value === '' ? null : Number(e.target.value))}
                                        placeholder="0.9"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Other models - always visible */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid grid-cols-[1fr,100px] gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="model-fix">Analysis Model</Label>
                                <ModelCombobox
                                    value={formData.model_fix || ''}
                                    onChange={(value) => handleChange('model_fix', value)}
                                    placeholder="Uses default model"
                                />
                                <p className="text-xs text-muted-foreground">
                                    For analyzing & fixing content
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fix-temperature">Temp</Label>
                                <Input
                                    id="fix-temperature"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="2"
                                    value={formData.temperature_fix ?? ''}
                                    onChange={(e) => handleChange('temperature_fix', e.target.value === '' ? null : Number(e.target.value))}
                                    placeholder="0.5"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr,100px] gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="model-polish">Polish Model</Label>
                                <ModelCombobox
                                    value={formData.model_polish || ''}
                                    onChange={(value) => handleChange('model_polish', value)}
                                    placeholder="Uses default model"
                                />
                                <p className="text-xs text-muted-foreground">
                                    For polishing & improving text
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="polish-temperature">Temp</Label>
                                <Input
                                    id="polish-temperature"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="2"
                                    value={formData.temperature_polish ?? ''}
                                    onChange={(e) => handleChange('temperature_polish', e.target.value === '' ? null : Number(e.target.value))}
                                    placeholder="0.7"
                                />
                            </div>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
