import React, { useState } from 'react';
import { StyleSheet, TextInput, View, Text, TextInputProps, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, radius, blur, animations, typography } from '../../theme';

interface GlassInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  icon?: React.ReactNode;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedView = Animated.View;

export function GlassInput({
  label,
  error,
  containerStyle,
  icon,
  ...props
}: GlassInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: animations.timing.fast });
    props.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: animations.timing.fast });
    props.onBlur?.(e);
  };

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [error ? colors.error : colors.glass.border, error ? colors.error : colors.primary]
    ),
  }));

  const useBlur = Platform.OS === 'ios';

  const inputContent = (
    <View style={styles.inputWrapper}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <TextInput
        {...props}
        style={[styles.input, icon ? styles.inputWithIcon : undefined]}
        placeholderTextColor={colors.textTertiary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        selectionColor={colors.primary}
      />
    </View>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {useBlur ? (
        <AnimatedView style={[styles.blurWrapper, animatedBorderStyle]}>
          <BlurView
            intensity={blur.light}
            tint="dark"
            style={styles.blurContainer}
          >
            {inputContent}
          </BlurView>
        </AnimatedView>
      ) : (
        <AnimatedView style={[styles.fallbackContainer, animatedBorderStyle]}>
          {inputContent}
        </AnimatedView>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  blurWrapper: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  blurContainer: {
    backgroundColor: colors.glass.background,
  },
  fallbackContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.glass.backgroundLight,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: colors.text,
  },
  inputWithIcon: {
    paddingLeft: 12,
  },
  error: {
    ...typography.caption1,
    color: colors.error,
    marginTop: 6,
    marginLeft: 4,
  },
});

export default GlassInput;
