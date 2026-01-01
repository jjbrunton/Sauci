import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useAmbientOrbAnimation, AmbientOrbConfig } from '../../hooks';
import { colors } from '../../theme';

export type OrbVariant = 'default' | 'chat' | 'premium';

export interface OrbPosition {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

export interface AmbientOrbsProps {
    /** Visual variant preset */
    variant?: OrbVariant;
    /** Custom animation config */
    animationConfig?: AmbientOrbConfig;
    /** Custom position for orb 1 */
    orb1Position?: OrbPosition;
    /** Custom position for orb 2 */
    orb2Position?: OrbPosition;
    /** Custom colors for orb 1 [primary, secondary]. Default: gold */
    orb1Colors?: [string, string];
    /** Custom colors for orb 2 [primary, secondary]. Default: rose */
    orb2Colors?: [string, string];
    /** Orb size */
    size?: number;
    /** Container style (for absolute positioning) */
    style?: ViewStyle;
}

// Preset configurations for different screens
const VARIANT_CONFIGS: Record<OrbVariant, {
    orb1Colors: [string, string];
    orb2Colors: [string, string];
    animationConfig?: AmbientOrbConfig;
}> = {
    default: {
        orb1Colors: [colors.premium.goldGlow, 'transparent'],
        orb2Colors: ['rgba(232, 164, 174, 0.2)', 'transparent'],
    },
    chat: {
        orb1Colors: [colors.premium.goldGlow, 'transparent'],
        orb2Colors: ['rgba(232, 164, 174, 0.2)', 'transparent'],
        animationConfig: {
            opacityRange1: [0.2, 0.4],
            opacityRange2: [0.15, 0.35],
        },
    },
    premium: {
        orb1Colors: [colors.premium.goldGlow, 'transparent'],
        orb2Colors: ['rgba(232, 164, 174, 0.25)', 'transparent'],
        animationConfig: {
            opacityRange1: [0.25, 0.5],
            opacityRange2: [0.2, 0.4],
        },
    },
};

// Default positions for orbs
const DEFAULT_ORB1_POSITION: OrbPosition = {
    top: 60,
    right: -40,
};

const DEFAULT_ORB2_POSITION: OrbPosition = {
    bottom: 180,
    left: -40,
};

/**
 * Ambient orbs component for premium visual atmosphere.
 * Provides floating, breathing gradient orbs as background decoration.
 * Used across swipe, chat, and matches screens.
 */
export function AmbientOrbs({
    variant = 'default',
    animationConfig,
    orb1Position = DEFAULT_ORB1_POSITION,
    orb2Position = DEFAULT_ORB2_POSITION,
    orb1Colors,
    orb2Colors,
    size = 300,
    style,
}: AmbientOrbsProps) {
    const variantConfig = VARIANT_CONFIGS[variant];

    // Merge animation config with variant defaults
    const finalAnimationConfig = animationConfig || variantConfig.animationConfig;

    // Get animation styles from hook
    const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation(finalAnimationConfig);

    // Final colors (props override variant defaults)
    const finalOrb1Colors = orb1Colors || variantConfig.orb1Colors;
    const finalOrb2Colors = orb2Colors || variantConfig.orb2Colors;

    const orbSize = {
        width: size,
        height: size,
        borderRadius: size / 2,
    };

    const gradientSize = {
        width: '100%' as const,
        height: '100%' as const,
        borderRadius: size / 2,
    };

    return (
        <>
            <Animated.View
                style={[
                    styles.orb,
                    orbSize,
                    orb1Position,
                    orbStyle1,
                    style,
                ]}
                pointerEvents="none"
            >
                <LinearGradient
                    colors={finalOrb1Colors}
                    style={gradientSize}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>
            <Animated.View
                style={[
                    styles.orb,
                    orbSize,
                    orb2Position,
                    orbStyle2,
                    style,
                ]}
                pointerEvents="none"
            >
                <LinearGradient
                    colors={finalOrb2Colors}
                    style={gradientSize}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0, y: 0 }}
                />
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    orb: {
        position: 'absolute',
    },
});

export default AmbientOrbs;
