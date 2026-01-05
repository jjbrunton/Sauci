# Content Balance Implementation

> Transform Sauci from binary explicit/clean filtering to graduated intensity-based control.

## Overview

### Problem
The current binary "Spicy Content" toggle is too coarse. Users either see ALL explicit content or NONE, which:
- Makes the app appear like "smut" to App Store reviewers if explicit is on
- Provides no middle ground for users who want flirty but not explicit content

### Solution
Replace the binary toggle with a 5-level intensity slider:

| Level | Label | Content Type |
|-------|-------|--------------|
| 1 | Light | Conversations, compliments, emotional connection |
| 2 | Mild | Cuddling, gentle kisses, flirty texts |
| 3 | Moderate | Making out, massage, suggestive content |
| 4 | Spicy | Intimate activities, explicit content |
| 5 | Intense | Advanced intimacy, kinks, fantasies |

### Key Changes
- **Default:** New users see max intensity 2 (Mild)
- **Control:** Graduated 1-5 slider instead of on/off
- **Filtering:** Filter by question intensity, not just pack explicit flag
- **Display:** Show intensity range on pack cards

---

## Tasks

### Phase 1: Database Migration

**File:** `apps/supabase/migrations/YYYYMMDDHHMMSS_add_intensity_levels.sql`

- [ ] Add `max_intensity` column to `profiles` table (INTEGER, default 2, CHECK 1-5)
- [ ] Migrate existing users: `show_explicit_content=true` → 5, else → 2
- [ ] Add `min_intensity`, `max_intensity`, `avg_intensity` columns to `question_packs`
- [ ] Create trigger to auto-update pack intensity stats when questions change
- [ ] Backfill intensity stats for existing packs

```sql
-- Example migration
ALTER TABLE profiles
ADD COLUMN max_intensity INTEGER DEFAULT 2
CHECK (max_intensity >= 1 AND max_intensity <= 5);

UPDATE profiles SET max_intensity = CASE
  WHEN show_explicit_content = true THEN 5
  ELSE 2
END;
```

---

### Phase 2: Mobile Types

**File:** `apps/mobile/src/types/index.ts`

- [ ] Add `max_intensity: 1 | 2 | 3 | 4 | 5` to `Profile` interface
- [ ] Add `min_intensity?: number`, `max_intensity?: number`, `avg_intensity?: number` to `QuestionPack` interface

---

### Phase 3: IntensitySlider Component

**File:** `apps/mobile/src/components/ui/IntensitySlider.tsx` (NEW)

- [ ] Create slider component with 5 levels
- [ ] Add flame icons that fill based on selected level
- [ ] Display label and description for current level
- [ ] Apply glass-morphism styling matching app theme
- [ ] Add haptic feedback on level change

```typescript
interface IntensitySliderProps {
  value: 1 | 2 | 3 | 4 | 5;
  onValueChange: (value: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}
```

---

### Phase 4: Onboarding Update

**File:** `apps/mobile/app/(app)/onboarding.tsx`

- [ ] Replace Stage 4 binary choice with IntensitySlider
- [ ] Update heading: "Set Your Comfort Level"
- [ ] Change default state from `showExplicit: false` to `maxIntensity: 2`
- [ ] Update profile save to set both fields for backwards compatibility

**Current Stage 4:**
```
"Show me everything" vs "Keep it clean"
```

**New Stage 4:**
```
"Set Your Comfort Level"
[Slider: 1 ----*---- 5]
         Light     Intense

Current: "Mild - Cuddling, gentle kisses, flirty texts"

Note: "Start gentle - you can turn up the heat anytime"
```

---

### Phase 5: Settings Update

**File:** `apps/mobile/src/features/profile/components/PrivacySettings.tsx`

- [ ] Replace `SwitchItem` with `IntensitySlider`

**File:** `apps/mobile/src/features/profile/hooks/useProfileSettings.ts`

- [ ] Change state from `showExplicit: boolean` to `maxIntensity: number`
- [ ] Update handler to save both `max_intensity` and `show_explicit_content`
- [ ] Call `fetchPacks()` after intensity change to refresh filtered packs

---

### Phase 6: Pack Store Filtering

**File:** `apps/mobile/src/store/packsStore.ts`

- [ ] Update `fetchPacks()` to filter by intensity instead of explicit flag

```typescript
// Current
if (!showExplicit) {
  query = query.eq("is_explicit", false);
}

// New
const maxIntensity = useAuthStore.getState().user?.max_intensity ?? 2;
query = query.or(`max_intensity.is.null,max_intensity.lte.${maxIntensity}`);
```

---

### Phase 7: Pack Display Enhancement

**File:** `apps/mobile/app/(app)/packs/questions.tsx`

- [ ] Add intensity badge to pack cards showing flame icons
- [ ] Display intensity label: "Light" or "Light - Moderate" range

---

### Phase 8: Default Packs for New Couples

**File:** `apps/supabase/functions/manage-couple/index.ts`

- [ ] When couple forms, auto-enable packs where `avg_intensity <= 2`

```typescript
const { data: safePacks } = await supabase
  .from('question_packs')
  .select('id')
  .lte('avg_intensity', 2)
  .eq('is_public', true);

await supabase.from('couple_packs').insert(
  safePacks.map(p => ({ couple_id, pack_id: p.id, enabled: true }))
);
```

---

## Files Summary

| File | Action |
|------|--------|
| `apps/supabase/migrations/XXX_add_intensity_levels.sql` | CREATE |
| `apps/mobile/src/types/index.ts` | MODIFY |
| `apps/mobile/src/components/ui/IntensitySlider.tsx` | CREATE |
| `apps/mobile/app/(app)/onboarding.tsx` | MODIFY |
| `apps/mobile/src/features/profile/components/PrivacySettings.tsx` | MODIFY |
| `apps/mobile/src/features/profile/hooks/useProfileSettings.ts` | MODIFY |
| `apps/mobile/src/store/packsStore.ts` | MODIFY |
| `apps/mobile/app/(app)/packs/questions.tsx` | MODIFY |
| `apps/supabase/functions/manage-couple/index.ts` | MODIFY |

---

## Backwards Compatibility

1. **Keep `show_explicit_content` column** during transition period
2. **Sync both fields** when user changes intensity:
   - `max_intensity >= 3` → `show_explicit_content = true`
   - `max_intensity < 3` → `show_explicit_content = false`
3. **Deprecation:** Remove `show_explicit_content` after 2-3 app update cycles

---

## App Store Benefits

After implementation:
- Default experience shows only Light/Mild content (levels 1-2)
- App Store screenshots will feature connection-focused questions
- Users must consciously opt-in to see spicier content
- Categories already ordered with connection-focused content first
