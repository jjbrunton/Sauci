import type { IntensityLevel } from '@/types';

export interface IntensityLevelConfig {
    level: IntensityLevel;
    label: string;
    emoji: string;
    description: string;
}

export const INTENSITY_LEVELS: IntensityLevelConfig[] = [
    { level: 1, label: 'Gentle', emoji: '💭', description: 'Easy conversation and everyday connection' },
    { level: 2, label: 'Warm', emoji: '💕', description: 'Romance, appreciation, and thoughtful moments' },
    { level: 3, label: 'Playful', emoji: '✨', description: 'Light-hearted questions and shared laughter' },
    { level: 4, label: 'Adventurous', emoji: '🌍', description: 'New experiences and ideas to try together' },
    { level: 5, label: 'Deep', emoji: '🌱', description: 'Meaningful reflection and honest conversation' },
];

export const HEAT_COLORS = [
    '#9b59b6', // Purple - gentle
    '#e94560', // Rose - warm
    '#ff6b6b', // Coral - playful
    '#ff4757', // Red - adventurous
    '#ff3333', // Bright red - intense
];
