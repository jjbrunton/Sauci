import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../../components/ui';
import { colors, typography, spacing } from '../../../theme';

export interface SettingsSectionProps {
    /** Section title displayed above the card */
    title: string;
    /** Animation delay in ms */
    delay?: number;
    /** Content to render inside the card */
    children: React.ReactNode;
}

/**
 * Reusable settings section with title and solid card container.
 */
export function SettingsSection({ title, delay = 200, children }: SettingsSectionProps) {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).duration(500)}
            style={styles.container}
        >
            <Text style={styles.title}>{title}</Text>
            <GlassCard>
                {children}
            </GlassCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.lg,
    },
    title: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 2,
        color: colors.textTertiary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
});

export default SettingsSection;
