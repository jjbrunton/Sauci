import { useEffect, useMemo, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import {
    IoHeartOutline,
    IoHeartHalfOutline,
    IoHeartCircleOutline,
    IoChatbubblesOutline,
    IoChatboxOutline,
    IoMailOutline,
    IoFlowerOutline,
    IoWineOutline,
    IoRestaurantOutline,
    IoCafeOutline,
    IoAirplaneOutline,
    IoCarOutline,
    IoCompassOutline,
    IoMapOutline,
    IoHomeOutline,
    IoPeopleOutline,
    IoPersonOutline,
    IoEyeOffOutline,
    IoKeyOutline,
    IoLockClosedOutline,
    IoDiceOutline,
    IoGiftOutline,
    IoSparklesOutline,
    IoStarOutline,
    IoFlameOutline,
    IoFlashOutline,
    IoMoonOutline,
    IoSunnyOutline,
    IoFlagOutline,
    IoCalendarOutline,
    IoCheckboxOutline,
    IoTrophyOutline,
    IoLayersOutline,
    IoCubeOutline,
    IoFolderOutline,
    IoBookmarkOutline,
    IoBulbOutline,
    IoColorWandOutline,
    IoSyncOutline,
    IoRefreshOutline,
    IoBriefcaseOutline,
} from 'react-icons/io5';
import { Button } from './button';
import { Input } from './input';

interface IconOption {
    name: string;
    Icon: IconType;
}

const ICON_OPTIONS: IconOption[] = [
    // Relationships & Love
    { name: 'heart-outline', Icon: IoHeartOutline },
    { name: 'heart-half-outline', Icon: IoHeartHalfOutline },
    { name: 'heart-circle-outline', Icon: IoHeartCircleOutline },

    // Communication
    { name: 'chatbubbles-outline', Icon: IoChatbubblesOutline },
    { name: 'chatbox-outline', Icon: IoChatboxOutline },
    { name: 'mail-outline', Icon: IoMailOutline },

    // Romance & Dates
    { name: 'flower-outline', Icon: IoFlowerOutline },
    { name: 'wine-outline', Icon: IoWineOutline },
    { name: 'restaurant-outline', Icon: IoRestaurantOutline },
    { name: 'cafe-outline', Icon: IoCafeOutline },

    // Adventure & Travel
    { name: 'airplane-outline', Icon: IoAirplaneOutline },
    { name: 'car-outline', Icon: IoCarOutline },
    { name: 'compass-outline', Icon: IoCompassOutline },
    { name: 'map-outline', Icon: IoMapOutline },

    // Home & Family
    { name: 'home-outline', Icon: IoHomeOutline },
    { name: 'people-outline', Icon: IoPeopleOutline },
    { name: 'person-outline', Icon: IoPersonOutline },

    // Mystery & Secrets
    { name: 'eye-off-outline', Icon: IoEyeOffOutline },
    { name: 'key-outline', Icon: IoKeyOutline },
    { name: 'lock-closed-outline', Icon: IoLockClosedOutline },

    // Fun & Games
    { name: 'dice-outline', Icon: IoDiceOutline },
    { name: 'gift-outline', Icon: IoGiftOutline },
    { name: 'sparkles-outline', Icon: IoSparklesOutline },
    { name: 'star-outline', Icon: IoStarOutline },

    // Intimacy
    { name: 'flame-outline', Icon: IoFlameOutline },
    { name: 'flash-outline', Icon: IoFlashOutline },
    { name: 'moon-outline', Icon: IoMoonOutline },
    { name: 'sunny-outline', Icon: IoSunnyOutline },

    // Goals & Planning
    { name: 'flag-outline', Icon: IoFlagOutline },
    { name: 'calendar-outline', Icon: IoCalendarOutline },
    { name: 'checkbox-outline', Icon: IoCheckboxOutline },
    { name: 'trophy-outline', Icon: IoTrophyOutline },

    // General
    { name: 'layers-outline', Icon: IoLayersOutline },
    { name: 'cube-outline', Icon: IoCubeOutline },
    { name: 'folder-outline', Icon: IoFolderOutline },
    { name: 'bookmark-outline', Icon: IoBookmarkOutline },
    { name: 'bulb-outline', Icon: IoBulbOutline },
    { name: 'color-wand-outline', Icon: IoColorWandOutline },
    { name: 'sync-outline', Icon: IoSyncOutline },
    { name: 'refresh-outline', Icon: IoRefreshOutline },
    { name: 'briefcase-outline', Icon: IoBriefcaseOutline },
];

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

    const SelectedIcon = ICONS_BY_NAME[value]?.Icon;
    const buttonLabel = SelectedIcon ? value : value ? 'Legacy icon' : 'Select an icon';

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
