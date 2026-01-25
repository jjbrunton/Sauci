import React, { useEffect } from 'react';
import { StyleSheet, Pressable, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, gradients, radius, animations } from '../../theme';

// Haptics is not supported on web
const triggerHaptic = async () => {
  if (Platform.OS === 'web') return;
  const Haptics = await import('expo-haptics');
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

interface GlassToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 26;
const PADDING = 2;

export function GlassToggle({
  value,
  onValueChange,
  disabled = false,
  style,
}: GlassToggleProps) {
  // Shared values for animation
  const progress = useSharedValue(value ? 1 : 0);

  // Sync shared value when prop changes
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      mass: 0.8,
      damping: 15,
      stiffness: 120,
    });
  }, [value]);

  const handlePress = async () => {
    if (disabled) return;
    await triggerHaptic();
    onValueChange(!value);
  };

  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: progress.value * (TRACK_WIDTH - THUMB_SIZE - (PADDING * 2)),
        },
      ],
    };
  });

  const trackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [colors.backgroundLight, 'transparent'] // Use backgroundLight for inactive
    );
    
    const borderColor = interpolateColor(
      progress.value,
      [0, 1],
      [colors.border, 'transparent'] // Use standard border for inactive
    );

    return {
      backgroundColor,
      borderColor,
    };
  });

  const activeGradientStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
    };
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.container, style, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        {/* Active Gradient Background (fades in) */}
        <Animated.View style={[StyleSheet.absoluteFill, activeGradientStyle]}>
          <LinearGradient
            colors={gradients.primary as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Thumb */}
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
  },
  track: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border, // Use standard border
    overflow: 'hidden',
    justifyContent: 'center',
    padding: PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabled: {
    opacity: 0.5,
  },
});
