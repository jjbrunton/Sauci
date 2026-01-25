/**
 * MatchConfetti - Premium celebration animation for match moments
 *
 * Uses Reanimated for smooth animations. Displays an elegant burst of
 * hearts and sparkles that explode outward, plus a prominent "It's a Match!" popup.
 */
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
    withSequence,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
    visible: boolean;
    onAnimationComplete?: () => void;
}

type ParticleShape = 'heart' | 'sparkle' | 'circle' | 'star';

interface Particle {
    id: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    rotation: number;
    color: string;
    size: number;
    delay: number;
    shape: ParticleShape;
}

const CONFETTI_COLORS = [
    colors.primary,        // Brand pink #e1306c
    '#FF6B9D',            // Hot pink
    '#FFB3C6',            // Light pink
    colors.premium.rose,   // Soft rose
    '#9b59b6',            // Secondary purple
    colors.premium.gold,   // Gold accent
    '#FF8A5B',            // Coral
    '#FFFFFF',            // White sparkle
];

const PARTICLE_COUNT = 40;

// Particle shapes distribution
const SHAPES: ParticleShape[] = ['heart', 'heart', 'sparkle', 'sparkle', 'circle', 'star'];

// Generate particle with physics-based trajectory
const generateParticle = (index: number): Particle => {
    // Start from center of screen
    const startX = SCREEN_WIDTH / 2;
    const startY = SCREEN_HEIGHT / 2 - 80;

    // Random angle for explosion (360 degrees) with more upward bias
    const baseAngle = (index / PARTICLE_COUNT) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.8;
    const velocity = 180 + Math.random() * 280;

    // Calculate end position - more spread, less gravity drop for hearts
    const endX = startX + Math.cos(angle) * velocity;
    const endY = startY + Math.sin(angle) * velocity + 250;

    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

    return {
        id: index,
        startX,
        startY,
        endX,
        endY,
        rotation: Math.random() * 540 - 270,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: shape === 'heart' ? 14 + Math.random() * 10 : 8 + Math.random() * 8,
        delay: Math.random() * 150,
        shape,
    };
};

// Heart shape component
const HeartShape: React.FC<{ size: number; color: string }> = ({ size, color }) => (
    <Ionicons name="heart" size={size} color={color} />
);

// Sparkle/star shape component
const SparkleShape: React.FC<{ size: number; color: string }> = ({ size, color }) => (
    <Ionicons name="sparkles" size={size} color={color} />
);

// Star shape component
const StarShape: React.FC<{ size: number; color: string }> = ({ size, color }) => (
    <Ionicons name="star" size={size} color={color} />
);

const ConfettiParticle: React.FC<{ particle: Particle; visible: boolean }> = ({
    particle,
    visible,
}) => {
    const progress = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            progress.value = 0;
            opacity.value = 1;

            progress.value = withDelay(
                particle.delay,
                withTiming(1, {
                    duration: 1000,
                    easing: Easing.out(Easing.cubic),
                })
            );

            opacity.value = withDelay(
                particle.delay + 600,
                withTiming(0, {
                    duration: 400,
                    easing: Easing.out(Easing.ease),
                })
            );
        } else {
            progress.value = 0;
            opacity.value = 0;
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => {
        const x = particle.startX + (particle.endX - particle.startX) * progress.value;
        const y = particle.startY + (particle.endY - particle.startY) * progress.value;
        const rotation = particle.rotation * progress.value;
        // Scale pulses slightly then shrinks
        const scale = interpolate(progress.value, [0, 0.2, 1], [0.5, 1.2, 0.6]);

        return {
            transform: [
                { translateX: x },
                { translateY: y },
                { rotate: `${rotation}deg` },
                { scale },
            ],
            opacity: opacity.value,
        };
    });

    const renderShape = () => {
        switch (particle.shape) {
            case 'heart':
                return <HeartShape size={particle.size} color={particle.color} />;
            case 'sparkle':
                return <SparkleShape size={particle.size} color={particle.color} />;
            case 'star':
                return <StarShape size={particle.size} color={particle.color} />;
            case 'circle':
            default:
                return (
                    <View
                        style={{
                            width: particle.size,
                            height: particle.size,
                            backgroundColor: particle.color,
                            borderRadius: particle.size / 2,
                        }}
                    />
                );
        }
    };

    return (
        <Animated.View style={[styles.particle, animatedStyle]}>
            {renderShape()}
        </Animated.View>
    );
};

// Animated popup message component - prominent and celebratory
const MatchPopup: React.FC<{ visible: boolean }> = ({ visible }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const iconScale = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Pop in with bouncy spring, then fade out after delay
            scale.value = withSequence(
                withSpring(1, { damping: 10, stiffness: 180 }),
                withDelay(3200, withTiming(0.9, { duration: 400 }))
            );

            // Fade in quickly, stay visible, then fade out
            opacity.value = withSequence(
                withTiming(1, { duration: 150 }),
                withDelay(3200, withTiming(0, { duration: 400 }))
            );

            // Heart icon bounces after text appears
            iconScale.value = withDelay(
                150,
                withSequence(
                    withSpring(1.3, { damping: 8, stiffness: 200 }),
                    withSpring(1, { damping: 12, stiffness: 200 })
                )
            );
        } else {
            scale.value = 0;
            opacity.value = 0;
            iconScale.value = 0;
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconScale.value }],
    }));

    return (
        <Animated.View style={[styles.popupContainer, animatedStyle]}>
            <View style={styles.popup}>
                <LinearGradient
                    colors={[colors.primary, '#9b59b6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.popupGradient}
                >
                    <Text style={styles.popupTitle}>You both answered!</Text>
                    <Animated.View style={iconAnimatedStyle}>
                        <Ionicons name="heart" size={32} color="#fff" style={styles.popupIcon} />
                    </Animated.View>
                </LinearGradient>
            </View>
        </Animated.View>
    );
};

export const MatchConfetti: React.FC<Props> = ({ visible, onAnimationComplete }) => {
    const particles = useMemo(
        () => Array.from({ length: PARTICLE_COUNT }, (_, i) => generateParticle(i)),
        []
    );

    // Trigger haptic and callback when animation starts
    useEffect(() => {
        if (visible) {
            // Celebration haptic pattern - satisfying burst
            if (Platform.OS !== 'web') {
                // Initial success notification
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Follow up with impacts for celebration feel
                setTimeout(() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                }, 80);
                setTimeout(() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }, 180);
                setTimeout(() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                }, 300);
            }

            // Notify parent when animation completes (after popup fades)
            if (onAnimationComplete) {
                const timer = setTimeout(() => {
                    onAnimationComplete();
                }, 4000);
                return () => clearTimeout(timer);
            }
        }
    }, [visible, onAnimationComplete]);

    if (!visible) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {/* Confetti particles */}
            {particles.map((particle) => (
                <ConfettiParticle
                    key={particle.id}
                    particle={particle}
                    visible={visible}
                />
            ))}

            {/* Match popup message */}
            <MatchPopup visible={visible} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    particle: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    popupContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    popup: {
        borderRadius: radius.xl,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 15,
        overflow: 'hidden',
    },
    popupGradient: {
        paddingHorizontal: spacing.xl + spacing.md,
        paddingVertical: spacing.lg + spacing.sm,
        alignItems: 'center',
    },
    popupTitle: {
        ...typography.title1,
        color: '#fff',
        fontWeight: '800',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    popupSubtext: {
        ...typography.callout,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    popupIcon: {
        marginTop: spacing.sm,
    },
});
