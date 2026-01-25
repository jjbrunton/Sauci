import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { IconPicker } from '@/components/ui/icon-picker';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, X } from 'lucide-react';
import { AIPolishButton } from '@/components/ai/AIPolishButton';

// =============================================================================
// Types
// =============================================================================

interface Topic {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
}

export interface PackFormData {
    name: string;
    description: string;
    icon: string;
    is_premium: boolean;
    is_public: boolean;
    is_explicit: boolean;
    category_id: string;
    scheduled_release_at?: string | null;  // Optional for backwards compatibility
    skip_notification?: boolean;  // If true, sets release_notified=true to skip notifications
}

export interface PackFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    formData: PackFormData;
    onFormChange: (data: PackFormData) => void;
    onSave: () => void;
    saving: boolean;
    isEditing: boolean;
    categories: Category[];
    allTopics: Topic[];
    selectedTopicIds: Set<string>;
    onTopicsChange: (topicIds: Set<string>) => void;
}

// =============================================================================
// Component
// =============================================================================

export function PackFormDialog({
    open,
    onOpenChange,
    formData,
    onFormChange,
    onSave,
    saving,
    isEditing,
    categories,
    allTopics,
    selectedTopicIds,
    onTopicsChange,
}: PackFormDialogProps) {
    const setField = <K extends keyof PackFormData>(field: K, value: PackFormData[K]) => {
        onFormChange({ ...formData, [field]: value });
    };

    const addTopic = (topicId: string) => {
        const next = new Set(selectedTopicIds);
        next.add(topicId);
        onTopicsChange(next);
    };

    const removeTopic = (topicId: string) => {
        const next = new Set(selectedTopicIds);
        next.delete(topicId);
        onTopicsChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit Pack' : 'Create Pack'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update the pack details below.'
                            : 'Add a new question pack to this category.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Icon */}
                    <div className="space-y-2">
                        <Label>Icon</Label>
                        <IconPicker
                            value={formData.icon}
                            onChange={(iconName) => setField('icon', iconName)}
                        />
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="name">Name</Label>
                            <AIPolishButton
                                text={formData.name}
                                type="pack_name"
                                onPolished={(val) => setField('name', val)}
                            />
                        </div>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setField('name', e.target.value)}
                            placeholder="e.g., 36 Questions to Fall in Love"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="description">Description</Label>
                            <AIPolishButton
                                text={formData.description}
                                type="pack_description"
                                onPolished={(val) => setField('description', val)}
                            />
                        </div>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setField('description', e.target.value)}
                            placeholder="Describe this pack..."
                            rows={3}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label>Category (optional)</Label>
                        <Select
                            value={formData.category_id || '__none__'}
                            onValueChange={(value) => setField('category_id', value === '__none__' ? '' : value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">No category</SelectItem>
                                {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Premium Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Premium Pack</Label>
                            <p className="text-sm text-muted-foreground">
                                Only available to premium users
                            </p>
                        </div>
                        <Switch
                            checked={formData.is_premium}
                            onCheckedChange={(checked) => setField('is_premium', checked)}
                        />
                    </div>

                    {/* Public Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Public</Label>
                            <p className="text-sm text-muted-foreground">
                                Visible to all users by default
                            </p>
                        </div>
                        <Switch
                            checked={formData.is_public}
                            onCheckedChange={(checked) => {
                                const next = {
                                    ...formData,
                                    is_public: checked,
                                    ...(checked ? { scheduled_release_at: null } : {}),
                                };
                                onFormChange(next);
                            }}
                        />
                    </div>

                    {/* Scheduled Release - only show when not public */}
                    {!formData.is_public && (
                        <div className="space-y-4 p-3 rounded-md bg-muted/50 border border-dashed">
                            <div className="space-y-2">
                                <Label htmlFor="scheduled_release_at">Scheduled Release</Label>
                                <p className="text-sm text-muted-foreground">
                                    Automatically make this pack public at a specific time. Users will be notified when it becomes available.
                                </p>
                                <Input
                                    id="scheduled_release_at"
                                    type="datetime-local"
                                    value={formData.scheduled_release_at ? new Date(formData.scheduled_release_at).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setField('scheduled_release_at', value ? new Date(value).toISOString() : null);
                                    }}
                                    className="w-full"
                                />
                                {formData.scheduled_release_at && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setField('scheduled_release_at', null)}
                                        className="mt-1"
                                    >
                                        Clear scheduled release
                                    </Button>
                                )}
                            </div>

                            {/* Skip Notification Toggle */}
                            <div className="flex items-center justify-between pt-2 border-t">
                                <div className="space-y-0.5">
                                    <Label>Skip release notification</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Release without notifying users
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.skip_notification ?? false}
                                    onCheckedChange={(checked) => setField('skip_notification', checked)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Explicit Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Explicit Content</Label>
                            <p className="text-sm text-muted-foreground">
                                Contains adult or mature content
                            </p>
                        </div>
                        <Switch
                            checked={formData.is_explicit}
                            onCheckedChange={(checked) => setField('is_explicit', checked)}
                        />
                    </div>

                    {/* Topics */}
                    <div className="space-y-2">
                        <Label>Topics</Label>
                        <p className="text-sm text-muted-foreground">
                            Select topics/kinks for filtering
                        </p>

                        {/* Selected topics */}
                        {selectedTopicIds.size > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                                {Array.from(selectedTopicIds).map(id => {
                                    const topic = allTopics.find(t => t.id === id);
                                    if (!topic) return null;
                                    return (
                                        <Badge
                                            key={id}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                            onClick={() => removeTopic(id)}
                                        >
                                            {topic.name}
                                            <X className="h-3 w-3 ml-1" />
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}

                        {/* Available topics */}
                        {allTopics.length > 0 ? (
                            <div className="flex flex-wrap gap-1 p-2 border rounded-md max-h-32 overflow-y-auto">
                                {allTopics
                                    .filter(t => !selectedTopicIds.has(t.id))
                                    .map(topic => (
                                        <Badge
                                            key={topic.id}
                                            variant="outline"
                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                            onClick={() => addTopic(topic.id)}
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {topic.name}
                                        </Badge>
                                    ))}
                                {allTopics.filter(t => !selectedTopicIds.has(t.id)).length === 0 && (
                                    <span className="text-xs text-muted-foreground">All topics selected</span>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">
                                No topics yet. Use "Extract Topics" on a pack to create some.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={onSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
