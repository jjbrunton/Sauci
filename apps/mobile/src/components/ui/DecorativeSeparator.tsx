import React from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { colors, spacing } from '../../theme';

export type SeparatorVariant = 'primary' | 'rose' | 'gold' | 'muted';

export interface DecorativeSeparatorProps {
    /** Color variant: 'primary' (default), 'rose' (quiz), 'gold' (premium/dares), 'muted' */
    variant?: SeparatorVariant;
    /** Width of the separator. Default: 140 */
    width?: DimensionValue;
    /** Vertical margin. Default: spacing.lg */
    marginVertical?: number;
    /** Additional container style */
    style?: ViewStyle;
}

const VARIANT_COLORS: Record<SeparatorVariant, { line: string; diamond: string }> = {
    primary: {
        line: 'rgba(225, 48, 108, 0.3)',
        diamond: colors.primary,
    },
    rose: {
        line: 'rgba(232, 164, 174, 0.3)',
        diamond: colors.premium.rose,
    },
    gold: {
        line: 'rgba(212, 175, 55, 0.3)',
        diamond: colors.premium.gold,
    },
    muted: {
        line: 'rgba(255, 255, 255, 0.1)',
        diamond: 'rgba(255, 255, 255, 0.3)',
    },
};

/**
 * Decorative separator with diamond accent.
 * Used for visual separation in waiting states, headers, and empty states.
 */
export const DecorativeSeparator: React.FC<DecorativeSeparatorProps> = ({
    variant = 'primary',
    width = 140,
    marginVertical = spacing.lg,
    style,
}) => {
    const variantColors = VARIANT_COLORS[variant];

    return (
        <View style={[styles.container, { width, marginVertical }, style]}>
            <View style={[styles.line, { backgroundColor: variantColors.line }]} />
            <View style={[styles.diamond, { backgroundColor: variantColors.diamond }]} />
            <View style={[styles.line, { backgroundColor: variantColors.line }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    line: {
        flex: 1,
        height: 1,
    },
    diamond: {
        width: 6,
        height: 6,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.sm,
        opacity: 0.7,
    },
});
