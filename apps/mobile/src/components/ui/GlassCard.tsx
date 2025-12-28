import React from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows, blur } from '../../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'light' | 'medium' | 'heavy';
  variant?: 'default' | 'elevated' | 'subtle';
  noPadding?: boolean;
}

export function GlassCard({
  children,
  style,
  intensity = 'medium',
  variant = 'default',
  noPadding = false,
}: GlassCardProps) {
  const blurIntensity = blur[intensity];
  const shadowStyle = variant === 'elevated' ? shadows.lg : variant === 'subtle' ? shadows.sm : shadows.md;
  const borderColor = variant === 'elevated' ? colors.glass.borderLight : colors.glass.border;

  // Use BlurView on iOS, fallback to solid background on Android for performance
  const useBlur = Platform.OS === 'ios';

  return (
    <View style={[styles.container, shadowStyle, style]}>
      {useBlur ? (
        <BlurView
          intensity={blurIntensity}
          tint="dark"
          style={[styles.blurContainer, { borderColor }]}
        >
          {/* Top highlight gradient */}
          <LinearGradient
            colors={[colors.glass.highlight, 'transparent']}
            style={styles.highlight}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={[styles.content, noPadding && styles.noPadding]}>
            {children}
          </View>
        </BlurView>
      ) : (
        // Android fallback with solid background
        <View style={[styles.fallbackContainer, { borderColor }]}>
          <LinearGradient
            colors={[colors.glass.highlight, 'transparent']}
            style={styles.highlight}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={[styles.content, noPadding && styles.noPadding]}>
            {children}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  blurContainer: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.glass.background,
  },
  fallbackContainer: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.glass.backgroundLight,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  content: {
    padding: 16,
  },
  noPadding: {
    padding: 0,
  },
});

export default GlassCard;
