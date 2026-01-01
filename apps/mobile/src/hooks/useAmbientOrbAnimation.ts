import { useEffect } from 'react';
import {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';

export interface AmbientOrbConfig {
    /** Opacity range for primary orb [min, max]. Default: [0.25, 0.5] */
    opacityRange1?: [number, number];
    /** Opacity range for secondary orb [min, max]. Default: [0.2, 0.4] */
    opacityRange2?: [number, number];
    /** Vertical drift distance in pixels. Default: 20 */
    driftDistance?: number;
    /** Scale range [min, max]. Default: [1, 1.1] */
    scaleRange?: [number, number];
}

const DEFAULT_CONFIG: Required<AmbientOrbConfig> = {
    opacityRange1: [0.25, 0.5],
    opacityRange2: [0.2, 0.4],
    driftDistance: 20,
    scaleRange: [1, 1.1],
};

/**
 * Hook for ambient orb breathing animations.
 * Used across swipe, chat, and other premium screens for visual atmosphere.
 *
 * @param config - Optional configuration for animation parameters
 * @returns Animated styles for two orbs
 */
export const useAmbientOrbAnimation = (config?: AmbientOrbConfig) => {
    const settings = { ...DEFAULT_CONFIG, ...config };

    const orbBreathing1 = useSharedValue(0);
    const orbBreathing2 = useSharedValue(0);
    const orbDrift = useSharedValue(0);

    useEffect(() => {
        // Primary orb breathing - 6 second cycle
        orbBreathing1.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Secondary orb breathing - offset timing for variation (8 second cycle)
        orbBreathing2.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Subtle vertical drift - 8 second cycle
        orbDrift.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const orbStyle1 = useAnimatedStyle(() => ({
        opacity: interpolate(
            orbBreathing1.value,
            [0, 1],
            settings.opacityRange1
        ),
        transform: [
            { translateY: interpolate(orbDrift.value, [0, 1], [0, -settings.driftDistance]) },
            { scale: interpolate(orbBreathing1.value, [0, 1], settings.scaleRange) },
        ],
    }));

    const orbStyle2 = useAnimatedStyle(() => ({
        opacity: interpolate(
            orbBreathing2.value,
            [0, 1],
            settings.opacityRange2
        ),
        transform: [
            { translateY: interpolate(orbDrift.value, [0, 1], [settings.driftDistance, 0]) },
            { scale: interpolate(orbBreathing2.value, [0, 1], settings.scaleRange) },
        ],
    }));

    return { orbStyle1, orbStyle2 };
};
