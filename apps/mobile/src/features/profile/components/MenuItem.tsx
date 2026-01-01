import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, featureColors } from '../../../theme';

export interface MenuItemProps {
    /** Icon name (Ionicons) */
    icon: string;
    /** Main label text */
    label: string;
    /** Description text below label */
    description?: string;
    /** Action when pressed */
    onPress: () => void;
    /** Optional element to show on the right */
    rightElement?: React.ReactNode;
    /** Whether to show chevron arrow */
    showChevron?: boolean;
    /** Visual variant */
    variant?: 'default' | 'danger';
    /** Disable the item */
    disabled?: boolean;
}

const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

/**
 * Reusable menu item row for settings screens.
 */
export function MenuItem({
    icon,
    label,
    description,
    onPress,
    rightElement,
    showChevron = true,
    variant = 'default',
    disabled = false,
}: MenuItemProps) {
    const isDanger = variant === 'danger';
    const iconColor = isDanger ? colors.error : colors.text;
    const labelColor = isDanger ? colors.error : colors.text;

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.7}
            disabled={disabled}
        >
            <View style={styles.left}>
                {isDanger ? (
                    <View style={styles.dangerIconContainer}>
                        <Ionicons name={icon as any} size={20} color={iconColor} />
                    </View>
                ) : (
                    <LinearGradient
                        colors={ACCENT_GRADIENT}
                        style={styles.iconContainer}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name={icon as any} size={20} color={iconColor} />
                    </LinearGradient>
                )}
                <View style={styles.textContainer}>
                    <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
                    {description && (
                        <Text style={styles.description}>{description}</Text>
                    )}
                </View>
            </View>
            {rightElement || (showChevron && (
                <View style={styles.chevron}>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
            ))}
        </TouchableOpacity>
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
    dangerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    textContainer: {
        flex: 1,
    },
    label: {
        ...typography.body,
        fontWeight: '500',
    },
    description: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    chevron: {
        padding: spacing.xs,
    },
});

export default MenuItem;
