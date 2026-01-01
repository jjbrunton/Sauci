import { useState, useEffect } from 'react';
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
import { Save, Eye, EyeOff, AlertTriangle, Bot, Sparkles, RefreshCw, Plus, Trash2, Package, Cherry } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ModelCombobox } from '@/components/ModelCombobox';

export function AiSettingsPage() {
    const { hasPermission, isSuperAdmin } = useAuth();
    const { config, loading, error, updateConfig, refetch } = useAiConfig();

    // Local form state
    const [formData, setFormData] = useState<Partial<AiConfig>>({});
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

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
                model_generate: config.model_generate || '',
                model_fix: config.model_fix || '',
                model_polish: config.model_polish || '',
                council_enabled: config.council_enabled || false,
                council_generator_model: config.council_generator_model || '',
                council_generators: generators,
                council_reviewer_model: config.council_reviewer_model || '',
                council_selection_mode: config.council_selection_mode || 'whole_set',
                cherry_pick_ensure_intensity_distribution: config.cherry_pick_ensure_intensity_distribution ?? true,
            });
            setHasChanges(false);
        }
    }, [config]);

    const handleChange = <K extends keyof AiConfig>(field: K, value: AiConfig[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
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
                model_generate: config.model_generate || '',
                model_fix: config.model_fix || '',
                model_polish: config.model_polish || '',
                council_enabled: config.council_enabled || false,
                council_generator_model: config.council_generator_model || '',
                council_generators: generators,
                council_reviewer_model: config.council_reviewer_model || '',
                council_selection_mode: config.council_selection_mode || 'whole_set',
                cherry_pick_ensure_intensity_distribution: config.cherry_pick_ensure_intensity_distribution ?? true,
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

    const updateGeneratorModel = (index: number, model: string) => {
        const newGenerators = generators.map((g, i) => i === index ? { ...g, model } : g);
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
                                                onChange={(value) => updateGeneratorModel(index, value)}
                                                placeholder={index === 0 ? "anthropic/claude-3.5-sonnet" : "Select model..."}
                                                className="flex-1"
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
                        )}
                    </div>

                    <Separator />

                    {/* Other models - always visible */}
                    <div className="grid md:grid-cols-2 gap-4">
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
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
