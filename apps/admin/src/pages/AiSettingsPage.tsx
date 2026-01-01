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
import { Save, Eye, EyeOff, AlertTriangle, Bot, Users, Sparkles, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Popular OpenRouter models for suggestions
const POPULAR_MODELS = {
    generation: [
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
        { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
    ],
    review: [
        { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
    ],
};

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
                        <Input
                            id="default-model"
                            value={formData.default_model || ''}
                            onChange={(e) => handleChange('default_model', e.target.value)}
                            placeholder="openai/gpt-4o-mini"
                            list="generation-models"
                        />
                        <p className="text-xs text-muted-foreground">
                            Fallback model when no specific model is configured
                        </p>
                    </div>

                    <Separator />

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="model-generate">Generation Model</Label>
                            <Input
                                id="model-generate"
                                value={formData.model_generate || ''}
                                onChange={(e) => handleChange('model_generate', e.target.value)}
                                placeholder="Uses default"
                                list="generation-models"
                            />
                            <p className="text-xs text-muted-foreground">
                                For generating questions & content
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="model-fix">Analysis Model</Label>
                            <Input
                                id="model-fix"
                                value={formData.model_fix || ''}
                                onChange={(e) => handleChange('model_fix', e.target.value)}
                                placeholder="Uses default"
                                list="generation-models"
                            />
                            <p className="text-xs text-muted-foreground">
                                For analyzing & fixing content
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="model-polish">Polish Model</Label>
                            <Input
                                id="model-polish"
                                value={formData.model_polish || ''}
                                onChange={(e) => handleChange('model_polish', e.target.value)}
                                placeholder="Uses default"
                                list="generation-models"
                            />
                            <p className="text-xs text-muted-foreground">
                                For polishing & improving text
                            </p>
                        </div>
                    </div>

                    {/* Datalist for model suggestions */}
                    <datalist id="generation-models">
                        {POPULAR_MODELS.generation.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name}
                            </option>
                        ))}
                    </datalist>
                </CardContent>
            </Card>

            {/* Council Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Council Mode
                    </CardTitle>
                    <CardDescription>
                        Enable multi-model review for quality assurance. Multiple generators can compete, and a reviewer picks the best output.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="council-enabled">Enable Council Mode</Label>
                            <p className="text-xs text-muted-foreground">
                                When enabled, generators run in parallel and a reviewer selects the best result
                            </p>
                        </div>
                        <Switch
                            id="council-enabled"
                            checked={formData.council_enabled || false}
                            onCheckedChange={(checked: boolean) => handleChange('council_enabled', checked)}
                        />
                    </div>

                    {formData.council_enabled && (
                        <>
                            <Separator />

                            {/* Generators Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Generator Models ({generators.length})</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Models that generate content in parallel. The reviewer picks the best output.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addGenerator}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Generator
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {generators.map((gen, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                                {index + 1}
                                            </div>
                                            <Input
                                                value={gen.model}
                                                onChange={(e) => updateGeneratorModel(index, e.target.value)}
                                                placeholder={index === 0 ? "anthropic/claude-3.5-sonnet" : "Enter model ID..."}
                                                list="generation-models"
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeGenerator(index)}
                                                disabled={generators.length <= 1}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                {generators.length > 1 && (
                                    <p className="text-xs text-muted-foreground">
                                        All {generators.length} generators will run in parallel. The reviewer will compare all outputs and select the best one.
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Reviewer Section */}
                            <div className="space-y-2">
                                <Label htmlFor="council-reviewer">Reviewer Model</Label>
                                <Input
                                    id="council-reviewer"
                                    value={formData.council_reviewer_model || ''}
                                    onChange={(e) => handleChange('council_reviewer_model', e.target.value)}
                                    placeholder="google/gemini-pro-1.5"
                                    list="review-models"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Model used to review, score, and select the best generated content
                                </p>
                            </div>

                            <datalist id="review-models">
                                {POPULAR_MODELS.review.map((model) => (
                                    <option key={model.id} value={model.id}>
                                        {model.name}
                                    </option>
                                ))}
                            </datalist>

                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Usage Note</AlertTitle>
                                <AlertDescription>
                                    Council mode uses {generators.length + 1} AI call{generators.length + 1 > 1 ? 's' : ''} per generation ({generators.length} generator{generators.length > 1 ? 's' : ''} + 1 reviewer), which increases API costs.
                                    Using different model providers gives diverse perspectives.
                                </AlertDescription>
                            </Alert>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
