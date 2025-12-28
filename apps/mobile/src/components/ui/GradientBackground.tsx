import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../../theme';

interface GradientBackgroundProps {
  children: React.ReactNode;
  variant?: 'default' | 'reverse' | 'subtle';
  style?: ViewStyle;
  showAccent?: boolean;
}

export function GradientBackground({
  children,
  variant = 'default',
  style,
  showAccent = false,
}: GradientBackgroundProps) {
  const gradientColors = variant === 'reverse'
    ? gradients.backgroundReverse
    : gradients.background;

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={gradientColors as [string, string]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {showAccent && (
        <>
          {/* Top-right accent glow */}
          <View style={styles.accentTopRight} />
          {/* Bottom-left accent glow */}
          <View style={styles.accentBottomLeft} />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  accentTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primaryGlow,
    opacity: 0.15,
  },
  accentBottomLeft: {
    position: 'absolute',
    bottom: -50,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.primaryGlow,
    opacity: 0.1,
  },
});

export default GradientBackground;
