import type { Ionicons } from "@expo/vector-icons";

type IoniconsName = keyof typeof Ionicons.glyphMap;

// Legacy emoji mappings (for backwards compatibility with existing packs)
const EMOJI_TO_IONICON: Record<string, IoniconsName> = {
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

export const PACK_ICON_MAP = EMOJI_TO_IONICON;

export const DEFAULT_PACK_ICON: IoniconsName = "layers-outline";

// List of valid Ionicon names (subset we support)
const VALID_IONICONS = new Set([
    "heart-outline",
    "heart-half-outline",
    "heart-circle-outline",
    "chatbubbles-outline",
    "chatbox-outline",
    "mail-outline",
    "flower-outline",
    "wine-outline",
    "restaurant-outline",
    "cafe-outline",
    "airplane-outline",
    "car-outline",
    "compass-outline",
    "map-outline",
    "home-outline",
    "people-outline",
    "person-outline",
    "eye-off-outline",
    "key-outline",
    "lock-closed-outline",
    "dice-outline",
    "gift-outline",
    "sparkles-outline",
    "star-outline",
    "flame-outline",
    "flash-outline",
    "moon-outline",
    "sunny-outline",
    "flag-outline",
    "calendar-outline",
    "checkbox-outline",
    "trophy-outline",
    "layers-outline",
    "cube-outline",
    "folder-outline",
    "bookmark-outline",
    "bulb-outline",
    "color-wand-outline",
    "sync-outline",
    "refresh-outline",
    "briefcase-outline",
]);

/**
 * Converts an icon value to an Ionicons name.
 * Handles both:
 * - Ionicon names directly (new packs): "briefcase-outline" -> "briefcase-outline"
 * - Legacy emojis (existing packs): "💼" -> "briefcase-outline"
 */
export function getPackIconName(icon: string | null | undefined): IoniconsName {
    if (!icon) return DEFAULT_PACK_ICON;

    if (VALID_IONICONS.has(icon)) {
        return icon as IoniconsName;
    }

    return EMOJI_TO_IONICON[icon] || DEFAULT_PACK_ICON;
}
