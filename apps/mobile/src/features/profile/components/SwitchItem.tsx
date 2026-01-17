import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, featureColors } from '../../../theme';
import { GlassToggle } from '../../../components/ui';

export interface SwitchItemProps {
    /** Icon name (Ionicons) */
    icon: string;
    /** Main label text */
    label: string;
    /** Description text below label */
    description: string;
    /** Switch value */
    value: boolean;
    /** Whether the switch is disabled */
    disabled?: boolean;
    /** Callback when value changes */
    onValueChange: (value: boolean) => void;
}

const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

/**
 * Reusable toggle switch row for settings screens.
 */
export function SwitchItem({
    icon,
    label,
    description,
    value,
    disabled = false,
    onValueChange,
}: SwitchItemProps) {
    return (
        <View style={styles.container}>
            <View style={styles.left}>
                <LinearGradient
                    colors={ACCENT_GRADIENT}
                    style={styles.iconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name={icon as any} size={20} color={colors.text} />
                </LinearGradient>
                <View style={styles.textContainer}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.description}>{description}</Text>
                </View>
            </View>
            <GlassToggle
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    left: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    label: {
        ...typography.body,
        fontWeight: '500',
        color: colors.text,
    },
    description: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
});

export default SwitchItem;
