import { Ionicons } from "@expo/vector-icons";

type IoniconsName = keyof typeof Ionicons.glyphMap;

/**
 * Checks if a string is a valid Ionicons name.
 * Uses the actual Ionicons.glyphMap for runtime validation.
 */
function isValidIonicon(name: string): name is IoniconsName {
    return name in Ionicons.glyphMap;
}

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

/**
 * Converts an icon value to an Ionicons name.
 * Handles both:
 * - Any valid Ionicon name directly: "briefcase-outline" -> "briefcase-outline"
 * - Legacy emojis (existing packs): "💼" -> "briefcase-outline"
 */
export function getPackIconName(icon: string | null | undefined): IoniconsName {
    if (!icon) return DEFAULT_PACK_ICON;

    // Check if it's a valid Ionicon name (supports the full Ionicons set)
    if (isValidIonicon(icon)) {
        return icon;
    }

    // Fall back to emoji mapping for legacy packs
    return EMOJI_TO_IONICON[icon] || DEFAULT_PACK_ICON;
}
