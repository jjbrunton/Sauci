import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
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

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function ShimmerEffect({
  children,
  style,
  shimmerColor = colors.premium.gold,
  duration = 2500,
  enabled = true,
}: ShimmerEffectProps) {
  const shimmerTranslate = useSharedValue(-1);

  useEffect(() => {
    if (enabled) {
      shimmerTranslate.value = withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1, // infinite repeat
        false // don't reverse
      );
    } else {
      shimmerTranslate.value = -1;
    }
  }, [enabled, duration]);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerTranslate.value,
      [-1, 1],
      [-200, 200]
    );

    return {
      transform: [
        { translateX },
        { rotate: '25deg' },
      ],
    };
  });

  return (
    <View style={[styles.container, style]}>
      {children}
      {enabled && (
        <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              `${shimmerColor}40`, // 25% opacity
              `${shimmerColor}60`, // 37% opacity
              `${shimmerColor}40`, // 25% opacity
              'transparent',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.shimmerGradient}
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
  shimmerContainer: {
    position: 'absolute',
    top: -50,
    bottom: -50,
    width: 100,
    left: '50%',
    marginLeft: -50,
  },
  shimmerGradient: {
    flex: 1,
    width: '100%',
  },
});

export default ShimmerEffect;
