import type { IntensityLevel } from '@/types';

export interface IntensityLevelConfig {
    level: IntensityLevel;
    label: string;
    emoji: string;
    description: string;
}

export const INTENSITY_LEVELS: IntensityLevelConfig[] = [
    { level: 1, label: 'Gentle', emoji: '💭', description: 'Pure emotional connection & non-sexual bonding' },
    { level: 2, label: 'Warm', emoji: '💕', description: 'Romantic atmosphere & affectionate touch' },
    { level: 3, label: 'Playful', emoji: '😏', description: 'Light sexual exploration & sensual discovery' },
    { level: 4, label: 'Steamy', emoji: '🔥', description: 'Explicit sexual activities & moderate adventure' },
    { level: 5, label: 'Intense', emoji: '🌶️', description: 'Advanced/BDSM/Extreme exploration' },
];

export const HEAT_COLORS = [
    '#9b59b6', // Purple - gentle
    '#e94560', // Rose - warm
    '#ff6b6b', // Coral - playful
    '#ff4757', // Red - steamy
    '#ff3333', // Bright red - intense
];
