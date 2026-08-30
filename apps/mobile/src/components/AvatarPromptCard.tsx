/**
 * AvatarPromptCard - Lightweight, dismissible nudge shown once after a
 * couple's first match, inviting a user with no profile photo to add one.
 * Renders after the match celebration completes, never on top of it.
 */
import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { GlassCard } from './ui/GlassCard';
import { colors, spacing, radius, typography } from '../theme';

interface Props {
    visible: boolean;
    onAddPhoto: () => void;
    onDismiss: () => void;
}

export const AvatarPromptCard: React.FC<Props> = ({ visible, onAddPhoto, onDismiss }) => {
    if (!visible) return null;

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <Animated.View
                entering={FadeInUp.duration(400)}
                exiting={FadeOutDown.duration(250)}
            >
                <GlassCard style={styles.card} variant="elevated">
                    <View style={styles.row}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="camera" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.textColumn}>
                            <Text style={styles.title}>Add a profile photo</Text>
                            <Text style={styles.subtitle}>
                                Let your partner see it's you
                            </Text>
                        </View>
                    </View>
                    <View style={styles.actions}>
                        <Pressable
                            style={styles.notNowButton}
                            onPress={onDismiss}
                            testID="avatar-prompt-not-now"
                        >
                            <Text style={styles.notNowText}>Not now</Text>
                        </Pressable>
                        <Pressable
                            style={styles.addPhotoButton}
                            onPress={onAddPhoto}
                            testID="avatar-prompt-add-photo"
                        >
                            <Text style={styles.addPhotoText}>Add photo</Text>
                        </Pressable>
                    </View>
                </GlassCard>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: spacing.xxl + spacing.lg,
        zIndex: 20,
    },
    card: {
        marginBottom: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    textColumn: {
        flex: 1,
    },
    title: {
        ...typography.headline,
        color: colors.text,
    },
    subtitle: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
    notNowButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    notNowText: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    addPhotoButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.primary,
    },
    addPhotoText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: '600',
    },
});

export default AvatarPromptCard;
