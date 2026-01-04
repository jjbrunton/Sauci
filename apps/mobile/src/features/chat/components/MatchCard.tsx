import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DecorativeSeparator } from '../../../components/ui';
import { colors, gradients, spacing, radius, typography } from '../../../theme';

// Premium color palette
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = 'rgba(212, 175, 55, ';

interface MatchCardProps {
    match: any;
    user: { id: string } | null;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, user }) => {
    if (!match?.question) return null;

    const isYesYes = match?.match_type === 'yes_yes';

    return (
        <Animated.View
            entering={FadeInDown.delay(100).duration(400).springify()}
            style={styles.matchCardContainer}
        >
            <View style={styles.matchCard}>
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

                {/* Question and Responses - Show who answered what */}
                {match.responses && match.responses.length > 0 ? (
                    <View style={styles.responsesContainer}>
                        {(() => {
                            // Sort responses by created_at to determine who answered first
                            const sortedResponses = [...match.responses].sort(
                                (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                            );
                            const isTwoPart = !!match.question.partner_text;

                            return sortedResponses.map((response: any, index: number) => {
                                const isUser = response.user_id === user?.id;
                                const isYes = response.answer === 'yes';
                                const name = isUser ? 'You' : (response.profiles?.name?.split(' ')[0] || 'Partner');

                                // First responder sees main text, second sees partner_text
                                const questionText = isTwoPart && index === 1
                                    ? match.question.partner_text
                                    : match.question.text;

                                return (
                                    <View key={response.user_id} style={styles.responseCard}>
                                        {/* Name and Answer Badge */}
                                        <View style={styles.responseHeader}>
                                            <Text style={styles.responseName}>{name}</Text>
                                            {isYes ? (
                                                <LinearGradient
                                                    colors={isYesYes
                                                        ? gradients.premiumGold as [string, string]
                                                        : [colors.success, '#27ae60']
                                                    }
                                                    style={styles.answerBadge}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <Ionicons name="checkmark" size={10} color={colors.text} />
                                                    <Text style={styles.answerBadgeText}>YES</Text>
                                                </LinearGradient>
                                            ) : (
                                                <View style={styles.answerBadgeMaybe}>
                                                    <Ionicons name="help" size={10} color={colors.warning} />
                                                    <Text style={styles.answerBadgeTextMaybe}>MAYBE</Text>
                                                </View>
                                            )}
                                        </View>
                                        {/* Question they saw */}
                                        <Text style={styles.responseQuestionText}>
                                            "{questionText}"
                                        </Text>
                                    </View>
                                );
                            });
                        })()}
                    </View>
                ) : (
                    <Text style={styles.matchQuestionText}>
                        "{match.question.text}"
                    </Text>
                )}

                {/* Premium border */}
                <View style={[
                    styles.matchCardBorder,
                    isYesYes && styles.matchCardBorderYesYes
                ]} pointerEvents="none" />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    matchCardContainer: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    matchCard: {
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
    responsesContainer: {
        width: '100%',
        gap: spacing.sm,
    },
    responseCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    responseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    responseName: {
        ...typography.caption1,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    answerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        gap: 3,
        borderRadius: radius.full,
    },
    answerBadgeText: {
        ...typography.caption2,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 0.5,
    },
    answerBadgeMaybe: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        gap: 3,
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(243, 156, 18, 0.3)',
        borderRadius: radius.full,
    },
    answerBadgeTextMaybe: {
        ...typography.caption2,
        fontWeight: '700',
        color: colors.warning,
        letterSpacing: 0.5,
    },
    responseQuestionText: {
        ...typography.footnote,
        color: colors.text,
        fontStyle: 'italic',
        lineHeight: 18,
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
