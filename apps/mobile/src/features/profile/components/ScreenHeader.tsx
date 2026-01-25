import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, featureColors } from '../../../theme';

export interface ScreenHeaderProps {
    /** Screen title */
    title: string;
    /** Optional element to render on the right side */
    rightElement?: React.ReactNode;
}

/**
 * Reusable header with back navigation for settings sub-screens.
 */
export function ScreenHeader({ title, rightElement }: ScreenHeaderProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleBack = () => {
        // Navigate back to the settings hub (profile tab)
        router.navigate('/(app)/profile');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
                {title}
            </Text>
            <View style={styles.rightContainer}>
                {rightElement || <View style={styles.placeholder} />}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: `${featureColors.profile.accent}15`,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        ...typography.headline,
        color: colors.text,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: spacing.md,
    },
    rightContainer: {
        minWidth: 40,
        alignItems: 'flex-end',
    },
    placeholder: {
        width: 40,
    },
});

export default ScreenHeader;
