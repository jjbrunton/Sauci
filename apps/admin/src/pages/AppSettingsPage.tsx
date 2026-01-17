import { useState, useEffect } from 'react';
import { useAppConfig, AppConfig } from '@/hooks/useAppConfig';
import { useAuth, PERMISSION_KEYS } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Save, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AppSettingsPage() {
    const { hasPermission, isSuperAdmin } = useAuth();
    const { config, loading, error, updateConfig, refetch } = useAppConfig();

    // Local form state
    const [formData, setFormData] = useState<Partial<AppConfig>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Permission check - only super admins or those with MANAGE_APP_CONFIG can access
    const canManage = isSuperAdmin || hasPermission(PERMISSION_KEYS.MANAGE_APP_CONFIG);

    // Initialize form data when config loads
    useEffect(() => {
        if (config) {
            setFormData({
                answer_gap_threshold: config.answer_gap_threshold ?? 10,
                daily_response_limit: config.daily_response_limit ?? 0,
                couple_intensity_gate_enabled: config.couple_intensity_gate_enabled ?? false,
            });
            setHasChanges(false);
        }
    }, [config]);

    const handleChange = <K extends keyof AppConfig>(field: K, value: AppConfig[K]) => {
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
                toast.success('App settings saved successfully');
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
            setFormData({
                answer_gap_threshold: config.answer_gap_threshold ?? 10,
                daily_response_limit: config.daily_response_limit ?? 0,
                couple_intensity_gate_enabled: config.couple_intensity_gate_enabled ?? false,
            });
            setHasChanges(false);
        }
    };

    if (!canManage) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You don't have permission to manage app settings. Contact a super admin for access.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">App Settings</h1>
                    <p className="text-muted-foreground">Configure mobile app behavior settings</p>
                </div>
                <div className="grid gap-6">
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">App Settings</h1>
                    <p className="text-muted-foreground">Configure mobile app behavior settings</p>
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
                    <h1 className="text-3xl font-bold tracking-tight">App Settings</h1>
                    <p className="text-muted-foreground">
                        Configure mobile app behavior settings
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

            {/* Answer Spam Prevention */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Answer Spam Prevention
                    </CardTitle>
                    <CardDescription>
                        Prevent one partner from getting too far ahead in answering questions
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Couple Comfort Zone Gate</Label>
                            <p className="text-sm text-muted-foreground">
                                When enabled, both recommended questions and answer-gap blocking use the lower of the two partners' comfort zones.
                            </p>
                        </div>
                        <Switch
                            checked={Boolean(formData.couple_intensity_gate_enabled)}
                            onCheckedChange={(checked) => handleChange('couple_intensity_gate_enabled', checked)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="threshold">Answer Gap Threshold</Label>
                        <Input
                            id="threshold"
                            type="number"
                            min="0"
                            max="100"
                            value={formData.answer_gap_threshold ?? 10}
                            onChange={(e) => handleChange('answer_gap_threshold', parseInt(e.target.value) || 0)}
                            className="max-w-[200px]"
                        />
                        <p className="text-xs text-muted-foreground">
                            Maximum number of questions a user can answer ahead of their partner.
                            When exceeded, they'll see a "Waiting for your partner" message.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Set to <strong>0</strong> to disable this feature.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Daily Response Limit */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Daily Response Limit (Free Users)
                    </CardTitle>
                    <CardDescription>
                        Limit the number of questions non-premium users can answer per day (UTC 00:00-23:59)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="dailyLimit">Daily Response Limit</Label>
                        <Input
                            id="dailyLimit"
                            type="number"
                            min="0"
                            max="1000"
                            value={formData.daily_response_limit ?? 0}
                            onChange={(e) => handleChange('daily_response_limit', parseInt(e.target.value) || 0)}
                            className="max-w-[200px]"
                        />
                        <p className="text-xs text-muted-foreground">
                            Maximum number of questions a non-premium user can answer per UTC day.
                            Premium users (via personal or partner subscription) bypass this limit.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Set to <strong>0</strong> to disable daily limits entirely.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Limit resets daily at 00:00 UTC. Editing existing answers does not count toward the limit.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
