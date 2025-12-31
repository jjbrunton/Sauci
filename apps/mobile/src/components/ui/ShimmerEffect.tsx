import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../theme';

interface ShimmerEffectProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shimmerColor?: string;
  duration?: number;
  enabled?: boolean;
}

export function ShimmerEffect({
  children,
  style,
  shimmerColor = colors.premium.gold,
  duration = 4000,
  enabled = true,
}: ShimmerEffectProps) {
  const glowIntensity = useSharedValue(0);

  useEffect(() => {
    if (enabled) {
      // Gentle breathing glow - slow fade in, hold, slow fade out, pause
      glowIntensity.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: duration * 0.4,
            easing: Easing.out(Easing.cubic),
          }),
          withDelay(
            duration * 0.2,
            withTiming(0, {
              duration: duration * 0.4,
              easing: Easing.in(Easing.cubic),
            })
          )
        ),
        -1,
        false
      );
    } else {
      glowIntensity.value = 0;
    }
  }, [enabled, duration]);

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(glowIntensity.value, [0, 1], [0, 0.6]),
    };
  });

  return (
    <View style={[styles.container, style]}>
      {children}
      {enabled && (
        <Animated.View style={[styles.glowContainer, glowStyle]} pointerEvents="none">
          {/* Top edge glow */}
          <LinearGradient
            colors={[`${shimmerColor}30`, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.edgeGlowTop}
          />
          {/* Bottom edge glow */}
          <LinearGradient
            colors={['transparent', `${shimmerColor}20`]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.edgeGlowBottom}
          />
          {/* Left edge glow */}
          <LinearGradient
            colors={[`${shimmerColor}25`, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.edgeGlowLeft}
          />
          {/* Right edge glow */}
          <LinearGradient
            colors={['transparent', `${shimmerColor}25`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.edgeGlowRight}
          />
          {/* Corner accents for refined look */}
          <LinearGradient
            colors={[`${shimmerColor}35`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cornerTopLeft}
          />
          <LinearGradient
            colors={[`${shimmerColor}35`, 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.cornerTopRight}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  edgeGlowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  edgeGlowBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 16,
  },
  edgeGlowLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 16,
  },
  edgeGlowRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 16,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
  },
});

export default ShimmerEffect;
