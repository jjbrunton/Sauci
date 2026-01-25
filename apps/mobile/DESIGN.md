# Sauci Design System

A boutique, premium design framework for the Sauci couples intimacy app.

## Brand Identity

**Aesthetic:** Boutique lingerie store meets modern dating app. Think Ann Summers sophistication - sensual but tasteful, premium but accessible, intimate but playful.

**Mood:** Romantic, luxurious, warm, inviting, confident

**Key Principles:**

- Dark, velvety backgrounds with subtle gradient atmosphere
- Solid, high-contrast surfaces (no glass or blur effects)
- Primary gradient (rose → purple) as the core brand signature
- Gold reserved for premium/dares features only
- Soft glows and shadows for depth, not transparency

---

## Color Hierarchy

### 1. Brand Colors (Primary Palette)

The core brand identity. Used for primary actions, key UI elements, and brand recognition.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Primary** | `#e1306c` | 225, 48, 108 | Primary buttons, active states, key accents |
| **Primary Dark** | `#c12055` | 193, 32, 85 | Pressed states, darker variants |
| **Secondary** | `#9b59b6` | 155, 89, 182 | Secondary accents, gradient endpoints |
| **Secondary Dark** | `#8e44ad` | 142, 68, 173 | Pressed states, darker variants |

**Primary Gradient:** `#e1306c → #9b59b6` (Rose to Purple)
- Direction: Left to right (horizontal) or top to bottom (vertical)
- Use for: Primary buttons, match celebrations, brand moments

### 2. Premium/Luxury Colors

The boutique palette. Used for premium features, upgrades, and luxury moments.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Gold** | `#D4AF37` | 212, 175, 55 | Premium badges, Dares feature, luxury accents |
| **Gold Dark** | `#B8860B` | 184, 134, 11 | Gold gradient endpoint |
| **Rose** | `#E8A4AE` | 232, 164, 174 | Quiz feature, soft premium accents |
| **Rose Dark** | `#D4919B` | 212, 145, 155 | Rose gradient endpoint |
| **Champagne** | `#F7E7CE` | 247, 231, 206 | Highlights, premium text accents |

### 3. Feature Colors

Each core feature has a designated accent color for consistency and recognition.

| Feature | Primary Color | Hex | Gradient |
|---------|---------------|-----|----------|
| **Swipe/Match** | Primary | `#e1306c` | Primary gradient (rose → purple) |
| **Quiz** | Rose | `#E8A4AE` | `#E8A4AE → #D4919B` |
| **Dares** | Gold | `#D4AF37` | `#D4AF37 → #B8860B` |
| **Chat** | Primary | `#e1306c` | Primary gradient |
| **Profile** | Secondary | `#9b59b6` | Secondary gradient |

**Usage Rules:**
- Feature icons use their designated color
- Feature headers/titles can use the color as an accent
- Feature-specific buttons should use the feature color
- Keep the feature color consistent across all screens for that feature

### 4. Background Colors

Dark, rich backgrounds that make content pop.

| Name | Hex | RGBA | Usage |
|------|-----|------|-------|
| **Background** | `#0e0e11` | 14, 14, 17 | Primary app background |
| **Background Light** | `#17171c` | 23, 23, 28 | Cards, elevated surfaces |
| **Surface** | `#17171c` | 23, 23, 28 | Primary surface color |
| **Surface Solid** | `#17171c` | 23, 23, 28 | Opaque surfaces |
| **Border** | `#303036` | 48, 48, 54 | Dividers, outlines, input borders |

### 5. Tile/Category Colors (Home Screen)

Discovery/Home tiles use vibrant, solid colors for quick recognition.

| Token | Hex |
|-------|-----|
| **teal** | `#14B8A6` |
| **purple** | `#8B5CF6` |
| **orange** | `#F97316` |
| **coral** | `#F87171` |
| **emerald** | `#10B981` |
| **indigo** | `#6366F1` |
| **rose** | `#EC4899` |
| **amber** | `#F59E0B` |

**Usage Rules:**
- Tiles are solid fills with a subtle dark overlay for depth
- Category colors are consistent across the app
- Avoid gradients on tiles unless it is a premium moment

### 6. Text Colors

| Name | RGBA | Usage |
|------|------|-------|
| **Text** | `#ffffff` | Primary text, headings |
| **Text Secondary** | `rgba(255, 255, 255, 0.7)` | Secondary text, descriptions |
| **Text Tertiary** | `rgba(255, 255, 255, 0.5)` | Disabled, hints, captions |

### 7. Semantic Colors

For system feedback and states.

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#2ECC71` | Yes responses, confirmations, positive states |
| **Warning** | `#F39C12` | Maybe responses, cautions |
| **Error** | `#E74C3C` | No responses, errors, destructive actions |
| **Muted** | `#6c757d` | Skip, disabled, inactive |

---

## Swipe Response Colors

Consistent across all swipe interactions:

| Response | Color | Hex/RGBA | Icon |
|----------|-------|----------|------|
| **Yes** | Success | `#2ECC71` / `rgba(46, 204, 113, 0.4)` | Checkmark |
| **No** | Error | `#E74C3C` / `rgba(231, 76, 60, 0.4)` | X |
| **Maybe** | Warning | `#F39C12` / `rgba(243, 156, 18, 0.4)` | Question mark |
| **Skip** | Muted | `#6c757d` / `rgba(108, 117, 125, 0.4)` | Forward arrow |

---

## Gradients

### Brand Gradients

```
Primary:         #e1306c → #9b59b6  (Rose to Purple)
Primary Subtle:  rgba(225, 48, 108, 0.8) → rgba(155, 89, 182, 0.8)
Primary Reverse: #9b59b6 → #e1306c  (Purple to Rose)
```

### Premium Gradients

```
Premium Gold:  #D4AF37 → #B8860B
Premium Rose:  #E8A4AE → #D4919B
```

### Background Gradients

```
Background:         #0e0e11 → #1f1417 → #0e0e11
Background Reverse: #0e0e11 → #1f1417 → #0e0e11
```

### Boutique Card Gradients

For pack cards and premium surfaces:

```
Boutique Rose:     rgba(233, 69, 96, 0.4) → rgba(155, 89, 182, 0.4)
Boutique Purple:   rgba(155, 89, 182, 0.4) → rgba(233, 69, 96, 0.4)
Boutique Dusty:    rgba(183, 110, 121, 0.35) → rgba(139, 69, 87, 0.35)
Boutique Gold:     rgba(212, 175, 55, 0.25) → rgba(184, 134, 11, 0.25)
Boutique Midnight: rgba(22, 33, 62, 0.8) → rgba(13, 13, 26, 0.8)
Boutique Amethyst: rgba(142, 68, 173, 0.4) → rgba(44, 62, 80, 0.4)
```

---

## Component Patterns

### Buttons

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| **Primary** | Primary gradient | White | None |
| **Secondary** | Surface | White | Border |
| **Ghost** | Transparent | Primary | None |
| **Danger** | Error gradient | White | None |
| **Feature** | Feature color gradient | White | None |

### Cards

| Variant | Background | Border | Use Case |
|---------|------------|--------|----------|
| **Solid** | Surface | Border | Standard content |
| **Raised** | Surface | Border | Emphasized content + shadow |
| **Tinted** | Category color | None | Home tiles, feature promos |

### Inputs

| State | Border Color | Background |
|-------|--------------|------------|
| **Default** | Border | Surface |
| **Focused** | Primary | Surface |
| **Error** | Error | Surface |
| **Disabled** | Border | Surface (opacity 0.6) |

---

## Tab Bar

| Element | Color |
|---------|-------|
| **Background** | `#0e0e11` |
| **Top Border** | `rgba(225, 48, 108, 0.2)` (primary tint) |
| **Active Icon** | Primary `#e1306c` |
| **Inactive Icon** | Text secondary |
| **Badge** | Rose `#E8A4AE` |

## Play Button (Center Tab)

The main "play" button uses the primary brand gradient for maximum brand presence.

| Element | Color |
|---------|-------|
| **Glow** | Primary glow `rgba(225, 48, 108, 0.3)` |
| **Border** | `rgba(225, 48, 108, 0.4)` |
| **Highlight** | Primary → Secondary gradient |
| **Icon** | Primary `#e1306c` |

## Radial Menu

Feature-specific colors for quick action items:

| Item | Variant | Color |
|------|---------|-------|
| **Match** | Primary | `#e1306c` (core feature) |
| **Dares** | Gold | `#D4AF37` (premium/adventure) |
| **Quiz** | Rose | `#E8A4AE` (intimacy) |

---

## Feature Icons (Locked)

**IMPORTANT:** These icons are locked and must be used consistently across the entire app (radial menu, page headers, buttons, etc.).

| Feature | Icon Name | Ionicons | Description |
|---------|-----------|----------|-------------|
| **Swipe/Match** | `flame` | 🔥 | Fire/passion - the core swiping experience |
| **Dares** | `flash` | ⚡ | Lightning bolt - adventure, excitement, energy |
| **Quiz** | `help-circle` | ❓ | Question mark - discovery, questions about each other |
| **Matches** (tab) | `heart` | ❤️ | Love heart - connections made between partners |
| **Profile** | `person` | 👤 | Person - user settings and profile |
| **Home** | `home` | 🏠 | Home - main dashboard |
| **Packs** | `layers` | 📚 | Layers - question pack collections |

**Usage Rules:**
- Always use the exact icon name specified above
- Use the feature's designated color with its icon
- Never swap icons between features
- Radial menu, page headers, and any feature references must use the same icon

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing, icon gaps |
| `sm` | 8px | Small gaps, compact layouts |
| `md` | 16px | Standard spacing |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Large gaps |
| `xxl` | 48px | Major sections |

---

## Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Small elements, tags |
| `sm` | 8px | Buttons, small cards |
| `md` | 12px | Standard cards |
| `lg` | 16px | Large cards |
| `xl` | 24px | Modal corners |
| `xxl` | 32px | Large containers |
| `full` | 9999px | Pills, circles |

---

## Typography

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `largeTitle` | 32px | Bold | 40px | Screen titles |
| `title1` | 28px | Bold | 34px | Section headers |
| `title2` | 24px | Bold | 30px | Card titles |
| `title3` | 20px | SemiBold | 26px | Subsection headers |
| `headline` | 17px | SemiBold | 22px | Emphasized body |
| `body` | 16px | Regular | 22px | Body text |
| `callout` | 15px | Regular | 20px | Secondary body |
| `subhead` | 14px | Regular | 20px | Supporting text |
| `footnote` | 13px | Regular | 18px | Captions |
| `caption1` | 12px | Regular | 16px | Small labels |
| `caption2` | 11px | Regular | 14px | Tiny text |

---

## Shadow Scale

| Style | Values | Usage |
|-------|--------|-------|
| `none` | — | Flat elements |
| `sm` | 0 2px 4px rgba(0,0,0,0.1) | Subtle lift |
| `md` | 0 4px 8px rgba(0,0,0,0.15) | Standard elevation |
| `lg` | 0 8px 16px rgba(0,0,0,0.2) | Prominent elevation |
| `xl` | 0 12px 24px rgba(0,0,0,0.25) | Maximum elevation |
| `glow` | 0 0 20px {color}Glow | Accent glow effect |

---

## Platform Considerations

### iOS
- Favor solid surfaces and shadows for depth
- Haptic feedback on interactions
- Native-feeling animations

### Android
- Match iOS surface colors and shadows
- Avoid blur and heavy transparency for performance
- Adjust shadow rendering as needed

---

## Do's and Don'ts

### Do
- Use the primary gradient for main CTAs
- Apply feature colors consistently within a feature
- Use solid surfaces with soft shadows for depth
- Keep text high-contrast (white on dark)
- Use gold/rose for premium moments

### Don't
- Mix feature colors within a single screen
- Use more than 2-3 accent colors per screen
- Apply the primary gradient to everything
- Use glass, blur, or frosted effects
- Use pure black (#000000) for backgrounds

---

## File Reference

**Theme Source:** `apps/mobile/src/theme/index.ts`

All colors, gradients, spacing, and typography are defined in the theme file. Always import from theme rather than hardcoding values.

```typescript
import { theme } from '@/theme';

// Usage
const styles = {
  backgroundColor: theme.colors.background,
  color: theme.colors.premium.gold,
};
```
