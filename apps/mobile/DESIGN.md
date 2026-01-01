# Sauci Design System

A boutique, premium design framework for the Sauci couples intimacy app.

## Brand Identity

**Aesthetic:** Boutique lingerie store meets modern dating app. Think Ann Summers sophistication - sensual but tasteful, premium but accessible, intimate but playful.

**Mood:** Romantic, luxurious, warm, inviting, confident

**Key Principles:**

- Glass-morphism for depth and elegance
- Dark backgrounds with warm accents
- Primary gradient (rose → purple) as the core brand signature
- Gold reserved for premium/dares features only
- Gradients for visual interest and brand recognition

---

## Color Hierarchy

### 1. Brand Colors (Primary Palette)

The core brand identity. Used for primary actions, key UI elements, and brand recognition.

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Primary** | `#e94560` | 233, 69, 96 | Primary buttons, active states, key accents |
| **Primary Dark** | `#c73a52` | 199, 58, 82 | Pressed states, darker variants |
| **Secondary** | `#9b59b6` | 155, 89, 182 | Secondary accents, gradient endpoints |
| **Secondary Dark** | `#8e44ad` | 142, 68, 173 | Pressed states, darker variants |

**Primary Gradient:** `#e94560 → #9b59b6` (Rose to Purple)
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
| **Swipe/Match** | Primary | `#e94560` | Primary gradient (rose → purple) |
| **Quiz** | Rose | `#E8A4AE` | `#E8A4AE → #D4919B` |
| **Dares** | Gold | `#D4AF37` | `#D4AF37 → #B8860B` |
| **Chat** | Primary | `#e94560` | Primary gradient |
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
| **Background** | `#0d0d1a` | 13, 13, 26 | Primary app background |
| **Background Light** | `#1a1a2e` | 26, 26, 46 | Cards, elevated surfaces |
| **Surface** | — | `rgba(22, 33, 62, 0.6)` | Glass overlays |
| **Surface Solid** | `#16213e` | 22, 33, 62 | Non-transparent surfaces |

### 5. Glass/Surface Colors

For the glass-morphism effect that defines the UI.

| Name | RGBA | Usage |
|------|------|-------|
| **Glass Background** | `rgba(22, 33, 62, 0.4)` | Standard glass cards |
| **Glass Background Heavy** | `rgba(22, 33, 62, 0.6)` | Emphasized glass cards |
| **Glass Border** | `rgba(255, 255, 255, 0.08)` | Subtle borders |
| **Glass Border Light** | `rgba(255, 255, 255, 0.12)` | Prominent borders |
| **Glass Highlight** | `rgba(255, 255, 255, 0.05)` | Top edge shine |

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
Primary:         #e94560 → #9b59b6  (Rose to Purple)
Primary Subtle:  rgba(233, 69, 96, 0.8) → rgba(155, 89, 182, 0.8)
Primary Reverse: #9b59b6 → #e94560  (Purple to Rose)
```

### Premium Gradients

```
Premium Gold:  #D4AF37 → #B8860B
Premium Rose:  #E8A4AE → #D4919B
```

### Background Gradients

```
Background:         #1a1a2e → #0d0d1a  (Light to Dark)
Background Reverse: #0d0d1a → #1a1a2e  (Dark to Light)
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
| **Secondary** | Glass background | White | Glass border |
| **Ghost** | Transparent | Primary | None |
| **Danger** | Error gradient | White | None |
| **Feature** | Feature color gradient | White | None |

### Cards

| Variant | Background | Border | Use Case |
|---------|------------|--------|----------|
| **Glass** | Glass background | Glass border | Standard content |
| **Glass Elevated** | Glass background heavy | Glass border light | Emphasized content |
| **Solid** | Background light | Glass border | Non-blur contexts |

### Inputs

| State | Border Color | Background |
|-------|--------------|------------|
| **Default** | Glass border | Glass background |
| **Focused** | Primary | Glass background |
| **Error** | Error | Glass background |
| **Disabled** | Glass border | Glass background (opacity 0.5) |

---

## Tab Bar

| Element | Color |
|---------|-------|
| **Background** | `rgba(13, 13, 26, 0.92)` with blur |
| **Top Border** | `rgba(233, 69, 96, 0.2)` (primary tint) |
| **Active Icon** | Primary `#e94560` |
| **Inactive Icon** | Text secondary |
| **Badge** | Rose `#E8A4AE` |

## Play Button (Center Tab)

The main "play" button uses the primary brand gradient for maximum brand presence.

| Element | Color |
|---------|-------|
| **Glow** | Primary glow `rgba(233, 69, 96, 0.3)` |
| **Border** | `rgba(233, 69, 96, 0.4)` |
| **Highlight** | Primary → Secondary gradient |
| **Icon** | Primary `#e94560` |

## Radial Menu

Feature-specific colors for quick action items:

| Item | Variant | Color |
|------|---------|-------|
| **Match** | Primary | `#e94560` (core feature) |
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
| `largeTitle` | 34px | Bold | 41px | Screen titles |
| `title1` | 28px | Bold | 34px | Section headers |
| `title2` | 22px | Bold | 28px | Card titles |
| `title3` | 20px | SemiBold | 25px | Subsection headers |
| `headline` | 17px | SemiBold | 22px | Emphasized body |
| `body` | 17px | Regular | 22px | Body text |
| `callout` | 16px | Regular | 21px | Secondary body |
| `subhead` | 15px | Regular | 20px | Supporting text |
| `footnote` | 13px | Regular | 18px | Captions |
| `caption1` | 12px | Regular | 16px | Small labels |
| `caption2` | 11px | Regular | 13px | Tiny text |

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
- Use BlurView for glass effects
- Haptic feedback on interactions
- Native-feeling animations

### Android
- Fallback to solid semi-transparent backgrounds
- Reduced blur intensity for performance
- Adjusted shadow rendering

---

## Do's and Don'ts

### Do
- Use the primary gradient for main CTAs
- Apply feature colors consistently within a feature
- Use glass effects for depth and hierarchy
- Keep text high-contrast (white on dark)
- Use gold/rose for premium moments

### Don't
- Mix feature colors within a single screen
- Use more than 2-3 accent colors per screen
- Apply the primary gradient to everything
- Use pure black (#000000) for backgrounds
- Forget to include the glow effect on premium elements

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
