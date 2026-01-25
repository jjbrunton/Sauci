import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { EdgeInsets } from 'react-native-safe-area-context';

import { colors, gradients, spacing, typography } from '../../../theme';
import { Profile } from '../../../types';

// Premium color palette for Chat
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = 'rgba(212, 175, 55, ';

interface ChatHeaderProps {
    partner: Profile | null;
    insets: EdgeInsets;
    onBack: () => void;
    onSettingsPress?: () => void;
}

const ChatHeaderComponent: React.FC<ChatHeaderProps> = ({
    partner,
    insets,
    onBack,
    onSettingsPress,
}) => {
    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
        >
            {/* Flat background */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }]} />
            
            {/* Gradient background - removed
            <LinearGradient
                colors={['rgba(22, 33, 62, 0.8)', 'rgba(13, 13, 26, 0.6)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            />
            */}
            {/* Top silk highlight - removed
            <LinearGradient
                colors={[`${ACCENT_RGBA}0.1)`, 'transparent']}
                style={styles.headerSilkHighlight}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />
            */}

            <TouchableOpacity
                onPress={onBack}
                style={styles.backButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go back to matches"
            >
                <View style={styles.backButtonInner}>
                    <Ionicons name="chevron-back" size={20} color={ACCENT} />
                </View>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
                {partner?.avatar_url ? (
                    <View style={styles.headerAvatarContainer}>
                        <Image
                            source={{ uri: partner.avatar_url }}
                            style={styles.headerAvatar}
                            cachePolicy="disk"
                            transition={200}
                        />
                        {/* Avatar ring */}
                        <View style={styles.avatarRing} />
                    </View>
                ) : (
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.headerAvatarGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.headerAvatarText}>
                            {partner?.name?.[0]?.toUpperCase() || "P"}
                        </Text>
                    </LinearGradient>
                )}
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerLabel}>CONVERSATION WITH</Text>
                    <Text style={styles.headerTitle}>{partner?.name || "Partner"}</Text>
                </View>
            </View>

            {onSettingsPress ? (
                <TouchableOpacity
                    onPress={onSettingsPress}
                    style={styles.settingsButton}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Chat settings"
                >
                    <View style={styles.backButtonInner}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={ACCENT} />
                    </View>
                </TouchableOpacity>
            ) : (
                <View style={styles.headerSpacer} />
            )}

            {/* Bottom border */}
            <View style={styles.headerBorderBottom} />
        </Animated.View>
    );
};

// Wrap with React.memo for performance
export const ChatHeader = React.memo(ChatHeaderComponent);

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        overflow: 'hidden',
    },
    headerSilkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ...
    headerSpacer: {
        width: 40,
    },
    settingsButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBorderBottom: {
        display: 'none',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    headerAvatarContainer: {
        position: 'relative',
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarRing: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: `${ACCENT_RGBA}0.3)`,
    },
    headerAvatarGradient: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    headerTextContainer: {
        alignItems: 'flex-start',
    },
    headerLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: ACCENT,
        opacity: 0.8,
    },
    headerTitle: {
        ...typography.headline,
        color: colors.text,
    },

});
