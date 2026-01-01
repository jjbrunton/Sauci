import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing, radius } from '../../theme';

export type LoadingVariant = 'spinner' | 'shimmer' | 'progress';

export interface LoadingOverlayProps {
    /** Whether the loading overlay is visible */
    visible: boolean;
    /** Visual variant of the loading indicator */
    variant?: LoadingVariant;
    /** Status text to display */
    statusText?: string;
    /** Secondary/detail text */
    detailText?: string;
    /** Progress value (0-100) for 'progress' variant */
    progress?: number;
    /** Custom spinner color */
    spinnerColor?: string;
    /** Whether to use full-screen overlay mode */
    fullScreen?: boolean;
    /** Custom container style */
    style?: ViewStyle;
    /** Custom text style */
    textStyle?: TextStyle;
}

/**
 * Flexible loading overlay component supporting multiple variants.
 * Used for upload status, loading states, and progress indicators.
 */
export function LoadingOverlay({
    visible,
    variant = 'spinner',
    statusText,
    detailText,
    progress = 0,
    spinnerColor = colors.premium.gold,
    fullScreen = false,
    style,
    textStyle,
}: LoadingOverlayProps) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        if (visible && variant === 'shimmer') {
            shimmer.value = withRepeat(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                -1,
                false
            );
        } else {
            shimmer.value = 0;
        }
    }, [visible, variant]);

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
    }));

    if (!visible) return null;

    const renderContent = () => {
        switch (variant) {
            case 'shimmer':
                return (
                    <Animated.View style={[styles.shimmerContent, shimmerStyle]}>
                        <ActivityIndicator color={spinnerColor} size="small" />
                        {statusText && (
                            <Text style={[styles.statusText, textStyle]}>{statusText}</Text>
                        )}
                        {detailText && (
                            <Text style={styles.detailText}>{detailText}</Text>
                        )}
                    </Animated.View>
                );

            case 'progress':
                return (
                    <View style={styles.progressContent}>
                        <View style={styles.progressBarContainer}>
                            <LinearGradient
                                colors={[colors.premium.gold, colors.premium.goldDark]}
                                style={[styles.progressBar, { width: `${Math.min(100, Math.max(0, progress))}%` }]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                        </View>
                        {statusText && (
                            <Text style={[styles.statusText, textStyle]}>{statusText}</Text>
                        )}
                        {detailText && (
                            <Text style={styles.detailText}>{detailText}</Text>
                        )}
                    </View>
                );

            case 'spinner':
            default:
                return (
                    <View style={styles.spinnerContent}>
                        <ActivityIndicator color={spinnerColor} size="large" />
                        {statusText && (
                            <Text style={[styles.statusText, textStyle]}>{statusText}</Text>
                        )}
                        {detailText && (
                            <Text style={styles.detailText}>{detailText}</Text>
                        )}
                    </View>
                );
        }
    };

    if (fullScreen) {
        return (
            <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                style={[styles.fullScreenContainer, style]}
            >
                {renderContent()}
            </Animated.View>
        );
    }

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[styles.container, style]}
        >
            {renderContent()}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
    },
    fullScreenContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(13, 13, 26, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    spinnerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    shimmerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    progressContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        width: '100%',
    },
    statusText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    detailText: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: 'center',
    },
    progressBarContainer: {
        width: '80%',
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: radius.full,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: radius.full,
    },
});

export default LoadingOverlay;
