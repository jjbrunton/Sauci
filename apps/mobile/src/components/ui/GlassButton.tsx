import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, gradients, radius, shadows, typography, animations } from '../../theme';

// Haptics is not supported on web
const triggerHaptic = async () => {
  if (Platform.OS === 'web') return;
  const Haptics = await import('expo-haptics');
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassButton({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  haptic = true,
  icon,
}: GlassButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, animations.spring);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, animations.spring);
  };

  const handlePress = async () => {
    if (disabled || loading) return;
    if (haptic) {
      await triggerHaptic();
    }
    onPress?.();
  };

  const sizeStyles = sizes[size];
  const variantStyles = variants[variant];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variantStyles.textColor}
          size="small"
          style={styles.loader}
        />
      ) : (
        <>
          {icon && <Animated.View style={styles.icon}>{icon}</Animated.View>}
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              { color: variantStyles.textColor },
              textStyle,
            ]}
          >
            {children}
          </Text>
        </>
      )}
    </>
  );

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        animatedStyle,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      ]}
    >
      {variant === 'primary' || variant === 'danger' ? (
        <LinearGradient
          colors={variantStyles.gradient as [string, string]}
          style={[
            styles.button,
            sizeStyles.button,
            shadows.md,
            style,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {content}
        </LinearGradient>
      ) : (
        <Animated.View
          style={[
            styles.button,
            sizeStyles.button,
            {
              backgroundColor: variantStyles.background,
              borderWidth: variantStyles.borderWidth,
              borderColor: variantStyles.borderColor,
            },
            variant === 'secondary' && shadows.sm,
            style,
          ]}
        >
          {content}
        </Animated.View>
      )}
    </AnimatedPressable>
  );
}

const variants = {
  primary: {
    gradient: gradients.primary,
    textColor: colors.text,
    background: undefined,
    borderWidth: 0,
    borderColor: undefined,
  },
  secondary: {
    gradient: undefined,
    textColor: colors.text,
    background: colors.glass.background,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  ghost: {
    gradient: undefined,
    textColor: colors.primary,
    background: 'transparent',
    borderWidth: 0,
    borderColor: undefined,
  },
  danger: {
    gradient: gradients.error,
    textColor: colors.text,
    background: undefined,
    borderWidth: 0,
    borderColor: undefined,
  },
};

const sizes = {
  sm: {
    button: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: radius.md,
    },
    text: {
      fontSize: 14,
      fontWeight: '600' as const,
    },
  },
  md: {
    button: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    text: {
      fontSize: 16,
      fontWeight: '600' as const,
    },
  },
  lg: {
    button: {
      paddingHorizontal: 32,
      paddingVertical: 18,
      borderRadius: radius.lg,
    },
    text: {
      fontSize: 18,
      fontWeight: '600' as const,
    },
  },
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  loader: {
    marginHorizontal: 8,
  },
  icon: {
    marginRight: 8,
  },
});

export default GlassButton;
