import type { Ionicons } from "@expo/vector-icons";

type IoniconsName = keyof typeof Ionicons.glyphMap;

/**
 * Maps emoji icons to Ionicons for a more professional, consistent appearance.
 * This eliminates the "AI slop" feel of heavy emoji usage while maintaining
 * visual differentiation between packs.
 */
export const PACK_ICON_MAP: Record<string, IoniconsName> = {
    // Career & Professional
    "💼": "briefcase-outline",

    // Relationships & Connection
    "🔗": "heart-half-outline",
    "❤️": "heart-outline",
    "💫": "sparkles-outline",

    // Secrets & Mystery
    "🤫": "eye-off-outline",
    "🗝️": "key-outline",

    // Romance & Dates
    "🌹": "flower-outline",
    "🍷": "wine-outline",
    "✨": "sparkles-outline",

    // Adventure & Travel
    "✈️": "airplane-outline",
    "🚗": "car-outline",
    "🏡": "home-outline",

    // Playful & Games
    "🎭": "color-wand-outline",
    "🎲": "dice-outline",
    "🎁": "gift-outline",

    // Intimacy & Physical
    "🔄": "sync-outline",
    "😈": "flash-outline",
    "🔥": "flame-outline",

    // Goals & Planning
    "🎯": "flag-outline",
    "☀️": "sunny-outline",

    // Default fallbacks
    "📦": "cube-outline",
    "📁": "folder-outline",
};

export const DEFAULT_PACK_ICON: IoniconsName = "layers-outline";

/**
 * Converts an emoji icon string to an Ionicons name.
 * Falls back to DEFAULT_PACK_ICON if no mapping exists.
 */
export function getPackIconName(emoji: string | null | undefined): IoniconsName {
    if (!emoji) return DEFAULT_PACK_ICON;
    return PACK_ICON_MAP[emoji] || DEFAULT_PACK_ICON;
}
