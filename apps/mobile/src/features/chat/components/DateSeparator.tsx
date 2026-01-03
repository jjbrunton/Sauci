import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../../theme';

interface DateSeparatorProps {
    date: Date;
}

/**
 * Formats a date for display in chat, similar to WhatsApp/Signal:
 * - "Today" for today's date
 * - "Yesterday" for yesterday
 * - "Monday" through "Saturday" for the past week
 * - "Jan 3, 2024" for older dates
 */
function formatDateLabel(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - messageDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    }

    if (diffDays === 1) {
        return 'Yesterday';
    }

    // Within the last week, show day name
    if (diffDays < 7) {
        return date.toLocaleDateString(undefined, { weekday: 'long' });
    }

    // Same year - show "Jan 3"
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
    }

    // Different year - show "Jan 3, 2024"
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
    const label = formatDateLabel(date);

    return (
        <View style={styles.container}>
            <View style={styles.pill}>
                <Text style={styles.text}>{label}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
    },
    pill: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    text: {
        ...typography.caption1,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
