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
    /** Text to display on the right side (e.g., partner name) */
    rightText?: string;
    /** Badge label to display (e.g., "Premium") */
    badge?: string;
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
    rightText,
    badge,
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
                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
                        {badge && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{badge}</Text>
                            </View>
                        )}
                    </View>
                    {description && (
                        <Text style={styles.description}>{description}</Text>
                    )}
                </View>
            </View>
            <View style={styles.rightSection}>
                {rightText && (
                    <Text style={styles.rightText} numberOfLines={1}>{rightText}</Text>
                )}
                {rightElement || (showChevron && (
                    <View style={styles.chevron}>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </View>
                ))}
            </View>
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
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)', // Added border
    },
    textContainer: {
        flex: 1,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    label: {
        ...typography.body,
        fontWeight: '500',
    },
    badge: {
        backgroundColor: colors.premium.goldLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
    },
    badgeText: {
        ...typography.caption2,
        color: colors.premium.gold,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    description: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    rightText: {
        ...typography.subhead,
        color: colors.textSecondary,
        maxWidth: 120,
    },
    chevron: {
        padding: spacing.xs,
    },
});

export default MenuItem;
