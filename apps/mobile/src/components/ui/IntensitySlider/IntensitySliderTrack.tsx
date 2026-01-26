import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { type AnimatedStyleProp } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import type { IntensityLevel } from '@/types';
import { HEAT_COLORS } from './constants';
import { styles } from './styles';

interface IntensitySliderTrackProps {
    value: IntensityLevel;
    progressStyle: AnimatedStyleProp<ViewStyle>;
}

export function IntensitySliderTrack({ value, progressStyle }: IntensitySliderTrackProps) {
    return (
        <View style={styles.trackContainer}>
            <View style={styles.track}>
                <Animated.View style={[styles.progressFill, progressStyle]}>
                    <LinearGradient
                        colors={['#9b59b6', HEAT_COLORS[value - 1]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </View>
        </View>
    );
}
