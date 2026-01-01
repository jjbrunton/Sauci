import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { EdgeInsets } from 'react-native-safe-area-context';

import { DecorativeSeparator } from '../../../components/ui';
import { colors, gradients, spacing, radius, typography } from '../../../theme';
import { Profile } from '../../../types';

// Premium color palette for Chat
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = 'rgba(212, 175, 55, ';

interface ChatHeaderProps {
    partner: Profile | null;
    user: { id: string } | null;
    match: any; // Using any for match as it has joined properties (question, responses)
    insets: EdgeInsets;
    onBack: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    partner,
    user,
    match,
    insets,
    onBack,
}) => {
    const isYesYes = match?.match_type === 'yes_yes';

    return (
        <>
            <Animated.View
                entering={FadeIn.duration(300)}
                style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
            >
                {/* Gradient background */}
                <LinearGradient
                    colors={['rgba(22, 33, 62, 0.8)', 'rgba(13, 13, 26, 0.6)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                />
                {/* Top silk highlight */}
                <LinearGradient
                    colors={[`${ACCENT_RGBA}0.1)`, 'transparent']}
                    style={styles.headerSilkHighlight}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />

                <TouchableOpacity
                    onPress={onBack}
                    style={styles.backButton}
                    activeOpacity={0.7}
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

                <View style={styles.headerSpacer} />

                {/* Bottom border */}
                <View style={styles.headerBorderBottom} />
            </Animated.View>

            {/* Premium Match Card */}
            {match?.question && (
                <Animated.View
                    entering={FadeInDown.delay(100).duration(400).springify()}
                    style={styles.matchCard}
                >
                    {/* Card gradient background */}
                    <LinearGradient
                        colors={isYesYes
                            ? ['rgba(212, 175, 55, 0.12)', 'rgba(184, 134, 11, 0.08)']
                            : ['rgba(232, 164, 174, 0.1)', 'rgba(22, 33, 62, 0.6)']
                        }
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />

                    {/* Top glow for YES+YES */}
                    {isYesYes && (
                        <LinearGradient
                            colors={[`${ACCENT_RGBA}0.15)`, 'transparent']}
                            style={styles.matchCardGlow}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                    )}

                    {/* Match Label */}
                    <Text style={[styles.matchLabel, isYesYes && styles.matchLabelYesYes]}>
                        {isYesYes ? "PERFECT MATCH" : "SOFT MATCH"}
                    </Text>

                    {/* Decorative Separator */}
                    <DecorativeSeparator
                        variant={isYesYes ? "gold" : "rose"}
                        width="60%"
                        marginVertical={spacing.md}
                    />

                    {/* Question Text */}
                    <Text style={styles.matchQuestionText}>
                        "{match.question.text}"
                    </Text>
                    {match.question.partner_text && (
                        <Text style={styles.matchQuestionPartnerText}>
                            "{match.question.partner_text}"
                        </Text>
                    )}

                    {/* Response Pills */}
                    {match.responses && match.responses.length > 0 && (
                        <View style={styles.responsePillsRow}>
                            {match.responses.map((response: any) => {
                                const isUser = response.user_id === user?.id;
                                const isYes = response.answer === 'yes';
                                return (
                                    <View key={response.user_id} style={styles.responsePillWrapper}>
                                        {isYes ? (
                                            <LinearGradient
                                                colors={isYesYes
                                                    ? gradients.premiumGold as [string, string]
                                                    : [colors.success, '#27ae60']
                                                }
                                                style={styles.responsePill}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                            >
                                                <Ionicons name="checkmark" size={12} color={colors.text} />
                                                <Text style={styles.responsePillText}>
                                                    {isUser ? 'You' : (response.profiles?.name?.split(' ')[0] || 'Partner')}
                                                </Text>
                                            </LinearGradient>
                                        ) : (
                                            <View style={styles.responsePillMaybe}>
                                                <Ionicons name="help" size={12} color={colors.warning} />
                                                <Text style={styles.responsePillTextMaybe}>
                                                    {isUser ? 'You' : (response.profiles?.name?.split(' ')[0] || 'Partner')}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Premium border */}
                    <View style={[
                        styles.matchCardBorder,
                        isYesYes && styles.matchCardBorderYesYes
                    ]} pointerEvents="none" />
                </Animated.View>
            )}
        </>
    );
};

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
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.2)`,
        justifyContent: 'center',
        alignItems: 'center',
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
    headerSpacer: {
        width: 40,
    },
    headerBorderBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: `${ACCENT_RGBA}0.15)`,
    },
    matchCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
        borderRadius: radius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        overflow: 'hidden',
    },
    matchCardGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    matchLabel: {
        ...typography.caption2,
        fontWeight: '700',
        letterSpacing: 2,
        color: colors.premium.rose,
        marginBottom: spacing.xs,
    },
    matchLabelYesYes: {
        color: ACCENT,
    },
    matchQuestionText: {
        ...typography.subhead,
        color: colors.text,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    matchQuestionPartnerText: {
        ...typography.caption1,
        color: colors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 2,
    },
    responsePillsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    responsePillWrapper: {
        overflow: 'hidden',
        borderRadius: radius.full,
    },
    responsePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        gap: 4,
    },
    responsePillText: {
        ...typography.caption2,
        fontWeight: '600',
        color: colors.text,
    },
    responsePillMaybe: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        gap: 4,
        backgroundColor: `rgba(243, 156, 18, 0.15)`,
        borderWidth: 1,
        borderColor: `rgba(243, 156, 18, 0.3)`,
        borderRadius: radius.full,
    },
    responsePillTextMaybe: {
        ...typography.caption2,
        fontWeight: '600',
        color: colors.warning,
    },
    matchCardBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: `rgba(232, 164, 174, 0.2)`,
    },
    matchCardBorderYesYes: {
        borderColor: `${ACCENT_RGBA}0.25)`,
    },
});
