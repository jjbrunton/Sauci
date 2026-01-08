# Pack Icons: Admin-First Approach

## Problem Statement

The current pack icon system uses emojis stored in the database, which creates a "AI slop" appearance. We've added a frontend mapping from emojis to Ionicons, but this is fragile:

- New packs require manual code changes to add mappings
- The mapping is hidden from admins
- It's a maintenance burden

## Solution: Admin-First Icon Selection

Allow admins to select Ionicons directly in the admin UI, storing the Ionicon name (e.g., `"briefcase-outline"`) in the database instead of emojis.

## Backwards Compatibility

**Important**: We must maintain backwards compatibility with the app currently in App Store review.

| App Version | DB has emoji "💼" | DB has "briefcase-outline" |
|-------------|-------------------|---------------------------|
| Old (in review) | Shows emoji | Shows literal text (broken) |
| New (with mapping) | Maps to Ionicon | Uses directly |

### Strategy

1. **Don't migrate existing data** - existing packs keep their emojis
2. **New packs use Ionicon names** - admin UI stores Ionicon names
3. **Mobile handles both formats** - detect format and handle appropriately

This ensures:
- Old app continues working with existing emoji packs
- New packs show default icon on old app (acceptable degradation)
- New app handles everything correctly

---

## Implementation Tasks

### Task 1: Create Ionicon Picker Component (Admin)

**File**: `apps/admin/src/components/ui/icon-picker.tsx` (new file)

Create a new component that displays a grid of available Ionicons for selection.

**Requirements**:
- Display commonly used Ionicons in a grid/dropdown
- Show icon preview with name
- Search/filter functionality (optional)
- Return the Ionicon name string (e.g., `"briefcase-outline"`)

**Suggested Icons to Include**:
```typescript
const AVAILABLE_ICONS = [
  // Relationships & Love
  'heart-outline', 'heart-half-outline', 'heart-circle-outline',

  // Communication
  'chatbubbles-outline', 'chatbox-outline', 'mail-outline',

  // Romance & Dates
  'flower-outline', 'wine-outline', 'restaurant-outline', 'cafe-outline',

  // Adventure & Travel
  'airplane-outline', 'car-outline', 'compass-outline', 'map-outline',

  // Home & Family
  'home-outline', 'people-outline', 'person-outline',

  // Mystery & Secrets
  'eye-off-outline', 'key-outline', 'lock-closed-outline',

  // Fun & Games
  'dice-outline', 'gift-outline', 'sparkles-outline', 'star-outline',

  // Intimacy
  'flame-outline', 'flash-outline', 'moon-outline', 'sunny-outline',

  // Goals & Planning
  'flag-outline', 'calendar-outline', 'checkbox-outline', 'trophy-outline',

  // General
  'layers-outline', 'cube-outline', 'folder-outline', 'bookmark-outline',
  'bulb-outline', 'color-wand-outline', 'sync-outline', 'refresh-outline',
];
```

**Component Interface**:
```typescript
interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}
```

---

### Task 2: Update Pack Form Dialog (Admin)

**File**: `apps/admin/src/components/content/PackFormDialog.tsx`

**Changes**:
1. Import new `IconPicker` component
2. Replace `EmojiPicker` with `IconPicker` for the icon field

**Current code (line ~101-104)**:
```tsx
<EmojiPicker
    value={formData.icon}
    onChange={(emoji) => setField('icon', emoji)}
/>
```

**New code**:
```tsx
<IconPicker
    value={formData.icon}
    onChange={(iconName) => setField('icon', iconName)}
/>
```

3. Update default icon in `initialFormData` (line ~41):
```typescript
// Change from '💕' to:
icon: 'heart-outline',
```

---

### Task 3: Update Category Form (Admin)

**File**: `apps/admin/src/pages/content/CategoriesPage.tsx`

Same changes as Task 2 - replace `EmojiPicker` with `IconPicker` for category icons.

---

### Task 4: Update AI Pack Generator (Admin)

**File**: `apps/admin/src/lib/ai/generators/packs.ts`

Update the AI prompt to suggest Ionicon names instead of emojis.

**Current (line ~147)**:
```typescript
- icon: A single descriptive emoji
```

**New**:
```typescript
- icon: An Ionicon name from this list: heart-outline, flame-outline, sparkles-outline, gift-outline, wine-outline, airplane-outline, home-outline, key-outline, flash-outline, sunny-outline, flower-outline, star-outline, dice-outline, compass-outline, bulb-outline
```

---

### Task 5: Update Mobile Icon Utility

**File**: `apps/mobile/src/lib/packIcons.ts`

Update `getPackIconName()` to handle both Ionicon names and legacy emojis.

**New implementation**:
```typescript
import type { Ionicons } from "@expo/vector-icons";

type IoniconsName = keyof typeof Ionicons.glyphMap;

// Legacy emoji mappings (for backwards compatibility with existing packs)
const EMOJI_TO_IONICON: Record<string, IoniconsName> = {
    "💼": "briefcase-outline",
    "🔗": "heart-half-outline",
    "❤️": "heart-outline",
    "💫": "sparkles-outline",
    "🤫": "eye-off-outline",
    "🗝️": "key-outline",
    "🌹": "flower-outline",
    "🍷": "wine-outline",
    "✨": "sparkles-outline",
    "✈️": "airplane-outline",
    "🚗": "car-outline",
    "🏡": "home-outline",
    "🎭": "color-wand-outline",
    "🎲": "dice-outline",
    "🎁": "gift-outline",
    "🔄": "sync-outline",
    "😈": "flash-outline",
    "🔥": "flame-outline",
    "🎯": "flag-outline",
    "☀️": "sunny-outline",
    "📦": "cube-outline",
    "📁": "folder-outline",
};

export const DEFAULT_PACK_ICON: IoniconsName = "layers-outline";

// List of valid Ionicon names (subset we support)
const VALID_IONICONS = new Set([
    'heart-outline', 'heart-half-outline', 'heart-circle-outline',
    'chatbubbles-outline', 'chatbox-outline', 'mail-outline',
    'flower-outline', 'wine-outline', 'restaurant-outline', 'cafe-outline',
    'airplane-outline', 'car-outline', 'compass-outline', 'map-outline',
    'home-outline', 'people-outline', 'person-outline',
    'eye-off-outline', 'key-outline', 'lock-closed-outline',
    'dice-outline', 'gift-outline', 'sparkles-outline', 'star-outline',
    'flame-outline', 'flash-outline', 'moon-outline', 'sunny-outline',
    'flag-outline', 'calendar-outline', 'checkbox-outline', 'trophy-outline',
    'layers-outline', 'cube-outline', 'folder-outline', 'bookmark-outline',
    'bulb-outline', 'color-wand-outline', 'sync-outline', 'refresh-outline',
    'briefcase-outline',
]);

/**
 * Converts an icon value to an Ionicons name.
 * Handles both:
 * - Ionicon names directly (new packs): "briefcase-outline" -> "briefcase-outline"
 * - Legacy emojis (existing packs): "💼" -> "briefcase-outline"
 */
export function getPackIconName(icon: string | null | undefined): IoniconsName {
    if (!icon) return DEFAULT_PACK_ICON;

    // Check if it's already a valid Ionicon name
    if (VALID_IONICONS.has(icon)) {
        return icon as IoniconsName;
    }

    // Fall back to emoji mapping for legacy data
    return EMOJI_TO_IONICON[icon] || DEFAULT_PACK_ICON;
}
```

---

### Task 6: Add Ionicons Package to Admin (if needed)

**File**: `apps/admin/package.json`

The admin app may need the Ionicons package to display icon previews.

```bash
cd apps/admin
npm install react-icons
```

Then use `IoIcons` from `react-icons/io5` which matches Ionicons naming.

Alternatively, create simple SVG components or use icon font directly.

---

## File Summary

| File | Action | Priority |
|------|--------|----------|
| `apps/admin/src/components/ui/icon-picker.tsx` | Create | High |
| `apps/admin/src/components/content/PackFormDialog.tsx` | Modify | High |
| `apps/admin/src/pages/content/CategoriesPage.tsx` | Modify | Medium |
| `apps/admin/src/lib/ai/generators/packs.ts` | Modify | Low |
| `apps/mobile/src/lib/packIcons.ts` | Modify | High |
| `apps/admin/package.json` | Modify (maybe) | Medium |

---

## Testing Checklist

- [ ] Create a new pack in admin with Ionicon - verify it saves correctly
- [ ] Edit an existing pack (with emoji) - verify emoji still displays in picker
- [ ] Mobile app displays new Ionicon packs correctly
- [ ] Mobile app displays legacy emoji packs correctly (via mapping)
- [ ] Old app version (if testable) shows default icon for new Ionicon packs

---

## Future Considerations

Once the new app version is widely deployed:
1. **Optional**: Run a database migration to convert remaining emojis to Ionicons
2. **Optional**: Remove emoji mapping code from mobile app
3. **Optional**: Add migration script admins can run per-pack

For now, the backwards-compatible approach means no database migrations and no breaking changes.
