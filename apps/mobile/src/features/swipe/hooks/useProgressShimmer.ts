import { useEffect } from "react";
import { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export const useProgressShimmer = () => {
    const shimmerPosition = useSharedValue(-1);

    useEffect(() => {
        shimmerPosition.value = withRepeat(
            withTiming(2, { duration: 2500, easing: Easing.linear }),
            -1,
            false
        );
    }, [shimmerPosition]);

    return useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(shimmerPosition.value, [-1, 2], [-60, 220]) },
        ],
    }));
};
