import { Platform } from 'react-native';

export const colors = {
  // Backgrounds - Updated to Flat/Admin Palette
  background: '#0e0e11', // hsl(240 10% 6%)
  backgroundLight: '#17171c', // hsl(240 8% 10%)
  surface: '#17171c', // Mapped to card color
  surfaceSolid: '#17171c',

  // Border
  border: '#303036', // hsl(240 6% 20%)

  // Glass effects - Retained keys for compat, but mapped to flat/subtle values
  glass: {
    background: '#17171c', // Solid card color
    backgroundLight: '#222228', // Slightly lighter
    border: '#303036',
    borderLight: '#404048',
    highlight: 'transparent', // Removed highlight
  },

  // Brand
  primary: '#e1306c', // Adjusted to match admin rose approximately
  primaryDark: '#c12055',
  primaryLight: 'rgba(225, 48, 108, 0.15)',
  primaryGlow: 'rgba(225, 48, 108, 0.3)',
  secondary: '#9b59b6',
  secondaryDark: '#8e44ad',
  secondaryLight: 'rgba(155, 89, 182, 0.15)',
  secondaryGlow: 'rgba(155, 89, 182, 0.3)',

  // Text
  text: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)', // Bumped from 0.6 for better contrast
  textTertiary: 'rgba(255, 255, 255, 0.5)', // Bumped from 0.4 for accessibility

  // Semantic
  success: '#2ECC71',
  successLight: 'rgba(46, 204, 113, 0.15)',
  warning: '#F39C12',
  warningLight: 'rgba(243, 156, 18, 0.15)',
  error: '#E74C3C',
  errorLight: 'rgba(231, 76, 60, 0.15)',
  info: '#53bdeb', // WhatsApp-like blue for read receipts

  // Premium/Luxury
  premium: {
    gold: '#D4AF37',
    goldDark: '#B8860B',
    goldLight: 'rgba(212, 175, 55, 0.15)',
    goldGlow: 'rgba(212, 175, 55, 0.3)',
    champagne: '#F7E7CE',
    champagneLight: 'rgba(247, 231, 206, 0.1)',
    rose: '#E8A4AE',
    roseDark: '#D4919B',
    roseLight: 'rgba(232, 164, 174, 0.15)',
    roseGlow: 'rgba(232, 164, 174, 0.3)',
  },

  // Swipe response overlays
  overlay: {
    yes: 'rgba(46, 204, 113, 0.4)',
    no: 'rgba(231, 76, 60, 0.4)',
    maybe: 'rgba(243, 156, 18, 0.4)',
    skip: 'rgba(108, 117, 125, 0.4)',
  },

  // Muted/disabled
  muted: '#6c757d',
  mutedLight: 'rgba(108, 117, 125, 0.15)',
};

export const gradients = {
  primary: ['#e1306c', '#9b59b6'],
  primarySubtle: ['rgba(225, 48, 108, 0.8)', 'rgba(155, 89, 182, 0.8)'],
  primaryReverse: ['#9b59b6', '#e1306c'],
  primaryVertical: ['#e1306c', '#9b59b6'],
  background: ['#0e0e11', '#1f1417', '#0e0e11'], // Premium subtle gradient from admin
  backgroundReverse: ['#0e0e11', '#1f1417', '#0e0e11'],
  glass: ['#17171c', '#17171c'], // Solid fallback
  success: ['#2ECC71', '#27ae60'],
  warning: ['#F39C12', '#e67e22'],
  error: ['#E74C3C', '#c0392b'],
  // Premium/Boutique gradients
  premiumGold: ['#D4AF37', '#B8860B'],
  premiumRose: ['#E8A4AE', '#D4919B'],
  silkLight: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'],
  laceTint: ['rgba(233, 69, 96, 0.15)', 'rgba(155, 89, 182, 0.15)'],
  // Boutique pack card backgrounds
  boutiqueRose: ['rgba(233, 69, 96, 0.4)', 'rgba(155, 89, 182, 0.4)'],
  boutiquePurple: ['rgba(155, 89, 182, 0.4)', 'rgba(233, 69, 96, 0.4)'],
  boutiqueDusty: ['rgba(183, 110, 121, 0.35)', 'rgba(139, 69, 87, 0.35)'],
  boutiqueGold: ['rgba(212, 175, 55, 0.25)', 'rgba(184, 134, 11, 0.25)'],
  boutiqueMidnight: ['rgba(22, 33, 62, 0.8)', 'rgba(13, 13, 26, 0.8)'],
  boutiqueAmethyst: ['rgba(142, 68, 173, 0.4)', 'rgba(44, 62, 80, 0.4)'],
};

// Feature-specific color mapping
// Each feature has a consistent accent color for icons, buttons, and highlights
// Tile colors for discovery screen - vibrant solid colors
export const tileColors = {
  teal: '#14B8A6',
  purple: '#8B5CF6',
  orange: '#F97316',
  coral: '#F87171',
  emerald: '#10B981',
  indigo: '#6366F1',
  rose: '#EC4899',
  amber: '#F59E0B',
};

// Map categories to tile colors
export const categoryColorMap: Record<string, string> = {
  // Common category names (lowercase for matching)
  passion: tileColors.coral,
  connection: tileColors.teal,
  fantasy: tileColors.purple,
  adventure: tileColors.orange,
  starter: tileColors.emerald,
  romance: tileColors.rose,
  intimacy: tileColors.indigo,
  communication: tileColors.amber,
};

// Get color for a category (with fallback)
// Accepts either a Category object or just the category name for backwards compatibility
export const getCategoryColor = (
  category?: { name?: string | null; color?: string | null } | string | null
): string => {
  // Handle string input (backwards compatibility)
  if (typeof category === 'string') {
    return getCategoryColorFromName(category);
  }

  // If category has an explicit color set, use it
  if (category?.color) {
    return category.color;
  }

  // Fall back to name-based logic
  return getCategoryColorFromName(category?.name);
};

// Internal helper: derive color from category name
const getCategoryColorFromName = (categoryName?: string | null): string => {
  if (!categoryName) return tileColors.teal;
  const normalizedName = categoryName.toLowerCase();
  // Check for partial matches
  for (const [key, color] of Object.entries(categoryColorMap)) {
    if (normalizedName.includes(key)) return color;
  }
  // Fallback: use consistent color based on string hash
  const hash = normalizedName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorKeys = Object.keys(tileColors) as (keyof typeof tileColors)[];
  return tileColors[colorKeys[hash % colorKeys.length]];
};

export const featureColors = {
  swipe: {
    accent: colors.primary,
    accentDark: colors.primaryDark,
    accentLight: colors.primaryLight,
    accentGlow: colors.primaryGlow,
    gradient: gradients.primary,
  },
  match: {
    accent: colors.primary,
    accentDark: colors.primaryDark,
    accentLight: colors.primaryLight,
    accentGlow: colors.primaryGlow,
    gradient: gradients.primary,
  },
  quiz: {
    accent: colors.premium.rose,
    accentDark: colors.premium.roseDark,
    accentLight: colors.premium.roseLight,
    accentGlow: colors.premium.roseGlow,
    gradient: gradients.premiumRose,
  },
  dares: {
    accent: colors.premium.gold,
    accentDark: colors.premium.goldDark,
    accentLight: colors.premium.goldLight,
    accentGlow: colors.premium.goldGlow,
    gradient: gradients.premiumGold,
  },
  chat: {
    accent: colors.primary,
    accentDark: colors.primaryDark,
    accentLight: colors.primaryLight,
    accentGlow: colors.primaryGlow,
    gradient: gradients.primary,
  },
  profile: {
    accent: colors.secondary,
    accentDark: colors.secondaryDark,
    accentLight: colors.secondaryLight,
    accentGlow: colors.secondaryGlow,
    gradient: gradients.primaryReverse,
  },
} as const;

export type FeatureName = keyof typeof featureColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const typography = {
  largeTitle: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    lineHeight: 40,
  },
  title1: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    lineHeight: 34,
  },
  title2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    lineHeight: 30,
  },
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
    lineHeight: 22,
  },
  callout: {
    fontSize: 15,
    fontWeight: 'normal' as const,
    lineHeight: 20,
  },
  subhead: {
    fontSize: 14,
    fontWeight: 'normal' as const,
    lineHeight: 20,
  },
  footnote: {
    fontSize: 13,
    fontWeight: 'normal' as const,
    lineHeight: 18,
  },
  caption1: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    lineHeight: 16,
  },
  caption2: {
    fontSize: 11,
    fontWeight: 'normal' as const,
    lineHeight: 14,
  },
};

export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  }),
};

export const blur = {
  light: 10,
  medium: 20,
  heavy: 40,
};

// Animation presets for react-native-reanimated
export const animations = {
  spring: {
    damping: 15,
    stiffness: 150,
  },
  springBouncy: {
    damping: 10,
    stiffness: 100,
  },
  springGentle: {
    damping: 20,
    stiffness: 120,
  },
  timing: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
};

export const theme = {
  colors,
  gradients,
  featureColors,
  tileColors,
  categoryColorMap,
  getCategoryColor,
  spacing,
  radius,
  typography,
  shadows,
  blur,
  animations,
};

export default theme;
