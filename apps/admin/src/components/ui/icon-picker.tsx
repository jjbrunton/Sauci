import { useEffect, useMemo, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import * as Io5Icons from 'react-icons/io5';
import { Button } from './button';
import { Input } from './input';

interface IconOption {
    name: string;
    Icon: IconType;
}

/**
 * Convert PascalCase component name to kebab-case Ionicon name.
 * e.g., "IoHeartOutline" -> "heart-outline"
 */
function toKebabCase(componentName: string): string {
    // Remove "Io" prefix
    const withoutPrefix = componentName.slice(2);
    // Convert PascalCase to kebab-case
    return withoutPrefix
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
}

// Build icon options from all Io5 icons dynamically
const ICON_OPTIONS: IconOption[] = Object.entries(Io5Icons)
    .filter(([name]) => name.startsWith('Io'))
    .map(([componentName, Icon]) => ({
        name: toKebabCase(componentName),
        Icon: Icon as IconType,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

const ICONS_BY_NAME = ICON_OPTIONS.reduce<Record<string, IconOption>>((acc, option) => {
    acc[option.name] = option;
    return acc;
}, {});

interface IconPreviewProps {
    value?: string | null;
    fallback?: string;
    className?: string;
}

export function IconPreview({ value, fallback = '?', className }: IconPreviewProps) {
    const resolved = value ?? fallback;
    const Icon = resolved ? ICONS_BY_NAME[resolved]?.Icon : undefined;

    if (Icon) {
        return <Icon className={className} />;
    }

    return <span className={className}>{resolved}</span>;
}

interface IconPickerProps {
    value: string;
    onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    const filteredIcons = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return ICON_OPTIONS;
        return ICON_OPTIONS.filter((option) => option.name.includes(normalized));
    }, [query]);

    const selectedOption = ICONS_BY_NAME[value];
    const SelectedIcon = selectedOption?.Icon;
    const buttonLabel = selectedOption ? value : value ? 'Legacy icon' : 'Select an icon';

    return (
        <div className="relative" ref={containerRef}>
            <Button
                type="button"
                variant="outline"
                className="h-14 w-full justify-start gap-3 px-3"
                onClick={() => setOpen(!open)}
            >
                {SelectedIcon ? (
                    <SelectedIcon className="h-6 w-6" />
                ) : (
                    <span className="text-2xl">{value || '?'}</span>
                )}
                <span className="text-sm text-muted-foreground">{buttonLabel}</span>
            </Button>
            {open && (
                <div className="absolute top-full left-0 mt-2 w-[22rem] rounded-md border bg-background p-3 shadow-lg z-50">
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search icons..."
                        className="mb-3"
                    />
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                        {filteredIcons.map(({ name, Icon }) => {
                            const isSelected = name === value;
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => {
                                        onChange(name);
                                        setOpen(false);
                                    }}
                                    className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors hover:bg-muted ${
                                        isSelected
                                            ? 'border-primary ring-1 ring-primary/40'
                                            : 'border-border'
                                    }`}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span className="text-[10px] leading-tight text-muted-foreground">
                                        {name}
                                    </span>
                                </button>
                            );
                        })}
                        {filteredIcons.length === 0 && (
                            <div className="col-span-4 text-xs text-muted-foreground">
                                No icons found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
