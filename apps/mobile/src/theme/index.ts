import { Platform } from 'react-native';

export const colors = {
  // Backgrounds
  background: '#0d0d1a',
  backgroundLight: '#1a1a2e',
  surface: 'rgba(22, 33, 62, 0.6)',
  surfaceSolid: '#16213e',

  // Glass effects
  glass: {
    background: 'rgba(22, 33, 62, 0.4)',
    backgroundLight: 'rgba(22, 33, 62, 0.6)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    highlight: 'rgba(255, 255, 255, 0.05)',
  },

  // Brand
  primary: '#e94560',
  primaryDark: '#c73a52',
  primaryLight: 'rgba(233, 69, 96, 0.15)',
  primaryGlow: 'rgba(233, 69, 96, 0.3)',
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

  // Premium/Luxury
  premium: {
    gold: '#D4AF37',
    goldLight: 'rgba(212, 175, 55, 0.15)',
    goldGlow: 'rgba(212, 175, 55, 0.3)',
    champagne: '#F7E7CE',
    champagneLight: 'rgba(247, 231, 206, 0.1)',
    rose: '#E8A4AE', // Lightened for accessibility (was #B76E79, now ~5.5:1 contrast)
    roseLight: 'rgba(232, 164, 174, 0.15)',
  },
};

export const gradients = {
  primary: ['#e94560', '#9b59b6'],
  primarySubtle: ['rgba(233, 69, 96, 0.8)', 'rgba(155, 89, 182, 0.8)'],
  primaryReverse: ['#9b59b6', '#e94560'],
  primaryVertical: ['#e94560', '#9b59b6'],
  background: ['#1a1a2e', '#0d0d1a'],
  backgroundReverse: ['#0d0d1a', '#1a1a2e'],
  glass: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0)'],
  success: ['#2ECC71', '#27ae60'],
  warning: ['#F39C12', '#e67e22'],
  error: ['#E74C3C', '#c0392b'],
  // Premium/Boutique gradients
  premiumGold: ['#D4AF37', '#B8860B'],
  premiumRose: ['#B76E79', '#8B4557'],
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
  spacing,
  radius,
  typography,
  shadows,
  blur,
  animations,
};

export default theme;
