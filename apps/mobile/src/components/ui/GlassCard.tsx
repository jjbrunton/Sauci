import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'light' | 'medium' | 'heavy'; // Kept for API compatibility
  variant?: 'default' | 'elevated' | 'subtle';
  noPadding?: boolean;
}

export function GlassCard({
  children,
  style,
  variant = 'default',
  noPadding = false,
}: GlassCardProps) {
  const shadowStyle = variant === 'elevated' ? shadows.lg : variant === 'subtle' ? shadows.sm : shadows.md;
  const borderColor = variant === 'elevated' ? colors.glass.borderLight : colors.glass.border;

  return (
    <View style={[styles.container, shadowStyle, style]}>
      <View style={[styles.flatContainer, { borderColor }]}>
        <View style={[styles.content, noPadding && styles.noPadding]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  flatContainer: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundLight, // Use solid card color
    // Removed border for flatter look
  },
  content: {
    padding: 16,
  },
  noPadding: {
    padding: 0,
  },
});

export default GlassCard;
