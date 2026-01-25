/**
 * MatchNotificationModal - Premium celebration modal for new matches
 *
 * Features:
 * - Glass-morphism styling following boutique design aesthetic
 * - Animated floating hearts celebration effect
 * - Shows what each partner answered (You / Partner)
 * - Uses brand gradients and premium styling
 */
import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    Keyboard,
    Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, spacing, radius, typography, shadows } from '../theme';
import { DecorativeSeparator } from './ui';
import type { MatchType, AnswerType } from '../types';

export interface MatchNotificationData {
    id: string;
    match_type: MatchType;
    question: {
        id: string;
        text: string;
        partner_text?: string | null;
    };
    userResponse?: AnswerType;
    partnerResponse?: AnswerType;
    partnerName?: string | null;
}

interface Props {
    visible: boolean;
    match: MatchNotificationData | null;
    onDismiss: () => void;
    onChat: () => void;
}

// Helper to get response styling
const getResponseStyle = (response: AnswerType, isPartner: boolean = false) => {
    switch (response) {
        case 'yes':
            return {
                bg: isPartner ? 'rgba(46, 204, 113, 0.15)' : 'rgba(233, 69, 96, 0.15)',
                border: isPartner ? 'rgba(46, 204, 113, 0.3)' : 'rgba(233, 69, 96, 0.3)',
                color: isPartner ? colors.success : colors.primary,
                text: 'YES',
                icon: 'heart' as const,
            };
        case 'maybe':
            return {
                bg: 'rgba(243, 156, 18, 0.15)',
                border: 'rgba(243, 156, 18, 0.3)',
                color: colors.warning,
                text: 'MAYBE',
                icon: 'help-circle' as const,
            };
        default:
            return {
                bg: 'rgba(255, 255, 255, 0.1)',
                border: 'rgba(255, 255, 255, 0.2)',
                color: colors.textSecondary,
                text: response.toUpperCase(),
                icon: 'ellipse' as const,
            };
    }
};

// Compact response badge (for two-part questions)
const ResponseBadge: React.FC<{
    response: AnswerType;
    isPartner?: boolean;
}> = ({ response, isPartner = false }) => {
    const style = getResponseStyle(response, isPartner);

    return (
        <View
            style={[
                styles.responseBadgeCompact,
                { backgroundColor: style.bg, borderColor: style.border },
            ]}
        >
            <Ionicons name={style.icon} size={14} color={style.color} />
            <Text style={[styles.responseBadgeTextCompact, { color: style.color }]}>
                {style.text}
            </Text>
        </View>
    );
};

export const MatchNotificationModal: React.FC<Props> = ({
    visible,
    match,
    onDismiss,
    onChat,
}) => {
    const modalScale = useRef(new Animated.Value(0.8)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Dismiss keyboard so it doesn't block the modal buttons
            Keyboard.dismiss();

            // Trigger celebration haptic pattern
            if (Platform.OS !== 'web') {
                // Success notification followed by a heavy impact for extra punch
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                }, 150);
            }

            // Reset animations
            modalScale.setValue(0.8);
            modalOpacity.setValue(0);
            overlayOpacity.setValue(0);

            // Animate in
            Animated.parallel([
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(modalScale, {
                    toValue: 1,
                    tension: 80,
                    friction: 10,
                    useNativeDriver: true,
                }),
                Animated.timing(modalOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(modalScale, {
                toValue: 0.8,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(modalOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => onDismiss());
    };

    const handleChat = () => {
        Animated.parallel([
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(modalScale, {
                toValue: 0.8,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(modalOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => onChat());
    };

    if (!visible || !match || !match.question) return null;

    // Determine responses based on match_type if not explicitly provided
    const getUserResponse = (): AnswerType => {
        if (match.userResponse) return match.userResponse;
        // Infer from match_type (user typically triggers the match)
        if (match.match_type === 'yes_yes') return 'yes';
        if (match.match_type === 'maybe_maybe') return 'maybe';
        // yes_maybe - user could be either
        return 'yes';
    };

    const getPartnerResponse = (): AnswerType => {
        if (match.partnerResponse) return match.partnerResponse;
        // Infer from match_type
        if (match.match_type === 'yes_yes') return 'yes';
        if (match.match_type === 'maybe_maybe') return 'maybe';
        // yes_maybe - partner could be either
        return 'maybe';
    };

    const userResponse = getUserResponse();
    const partnerResponse = getPartnerResponse();

    // Get match type styling
    const getMatchTypeLabel = () => {
        switch (match.match_type) {
            case 'yes_yes':
                return { text: 'Perfect Match', color: colors.primary };
            case 'yes_maybe':
                return { text: 'Curious Match', color: colors.warning };
            case 'maybe_maybe':
                return { text: 'Exploring Together', color: colors.premium.rose };
            default:
                return { text: 'Match', color: colors.primary };
        }
    };

    const matchTypeInfo = getMatchTypeLabel();

    // Use partner's name or fallback to "Partner"
    const partnerDisplayName = match.partnerName || 'Partner';

    return (
        <Animated.View
            style={[styles.overlay, { opacity: overlayOpacity }]}
        >
            {/* Background press to dismiss */}
            <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />

            {/* Modal card with glow */}
            <Animated.View
                style={[
                    styles.glowContainer,
                    {
                        transform: [{ scale: modalScale }],
                        opacity: modalOpacity,
                    },
                ]}
            >
                {/* Outer glow effect */}
                <View style={styles.glowOuter} />

                <View style={styles.modalContainer}>
                    {/* Flat background */}
                    <View style={styles.flatBackground} />
                    {/* Content */}
                    <View style={styles.content}>
                            {/* Title section */}
                            <Text style={styles.title}>It's a Match!</Text>

                        {/* Match type badge */}
                        <View style={[styles.matchTypeBadge, { borderColor: `${matchTypeInfo.color}30` }]}>
                            <Text style={[styles.matchTypeText, { color: matchTypeInfo.color }]}>
                                {matchTypeInfo.text}
                            </Text>
                        </View>

                        <DecorativeSeparator variant="muted" width={80} marginVertical={spacing.md} />

                        {/* Question text and responses */}
                        {match.question.partner_text ? (
                            // Two-part question - show what each person saw
                            // The current user triggered the match (answered second), so they saw partner_text
                            // The partner answered first, so they saw text
                            <View style={styles.twoPartContainer}>
                                <View style={styles.responseSection}>
                                    <View style={styles.responseLabelRow}>
                                        <Text style={styles.responsePersonLabel}>You said</Text>
                                        <ResponseBadge response={userResponse} />
                                    </View>
                                    <Text style={styles.questionTextSmall}>"{match.question.partner_text}"</Text>
                                </View>

                                <View style={styles.matchConnector}>
                                    <View style={styles.connectorLine} />
                                    <View style={styles.connectorHeart}>
                                        <Ionicons name="heart" size={16} color={colors.primary} />
                                    </View>
                                    <View style={styles.connectorLine} />
                                </View>

                                <View style={styles.responseSection}>
                                    <View style={styles.responseLabelRow}>
                                        <Text style={styles.responsePersonLabel}>{partnerDisplayName} said</Text>
                                        <ResponseBadge response={partnerResponse} isPartner />
                                    </View>
                                    <Text style={styles.questionTextSmall}>"{match.question.text}"</Text>
                                </View>
                            </View>
                        ) : (
                            // Single question - show shared text with inline responses
                            <View style={styles.questionContainer}>
                                <Text style={styles.questionText}>"{match.question.text}"</Text>
                                <View style={styles.responsesInline}>
                                    <Text style={styles.responseInlineText}>You said </Text>
                                    <Text style={[styles.responseInlineAnswer, { color: userResponse === 'yes' ? colors.primary : colors.warning }]}>
                                        {userResponse.toUpperCase()}
                                    </Text>
                                    <Text style={styles.responseInlineText}> · {partnerDisplayName} said </Text>
                                    <Text style={[styles.responseInlineAnswer, { color: partnerResponse === 'yes' ? colors.success : colors.warning }]}>
                                        {partnerResponse.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <DecorativeSeparator variant="muted" width={100} marginVertical={spacing.md} />

                        {/* Action buttons */}
                        <View style={styles.buttonRow}>
                            <Pressable onPress={handleChat} style={styles.chatButton}>
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.chatButtonGradient}
                                >
                                    <Ionicons name="chatbubble" size={16} color={colors.text} />
                                    <Text style={styles.chatButtonText}>Chat</Text>
                                </LinearGradient>
                            </Pressable>

                            <Pressable onPress={handleDismiss} style={styles.dismissButton}>
                                <Text style={styles.dismissButtonText}>Continue</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    glowContainer: {
        width: '88%',
        maxWidth: 360,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowOuter: {
        position: 'absolute',
        top: -3,
        left: -3,
        right: -3,
        bottom: -3,
        borderRadius: radius.xl + 3,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.primary, // Simpler border
        opacity: 0.2, // Subtle opacity
    },
    modalContainer: {
        width: '100%',
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: colors.backgroundLight, // Solid background
        borderWidth: 1,
        borderColor: colors.border,
    },
    flatBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.backgroundLight,
    },
    // Removed blur/gradient styles
    content: {
        padding: spacing.xl,
        paddingTop: spacing.lg,
        alignItems: 'center',
    },
    title: {
        ...typography.title2,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    matchTypeBadge: {
        backgroundColor: colors.background, // Darker flat background
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        marginBottom: spacing.lg,
    },
    matchTypeText: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 1,
    },
    questionContainer: {
        alignItems: 'center',
    },
    questionText: {
        ...typography.body,
        color: colors.text,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 24,
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.md,
    },
    responsesInline: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
    },
    responseInlineText: {
        ...typography.caption1,
        color: colors.textSecondary,
    },
    responseInlineAnswer: {
        ...typography.caption1,
        fontWeight: '700',
    },
    responseBadgeCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        borderWidth: 1,
    },
    responseBadgeTextCompact: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    // Two-part question styles
    twoPartContainer: {
        width: '100%',
        marginBottom: spacing.md,
    },
    responseSection: {
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
    },
    responseLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    responsePersonLabel: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    questionTextSmall: {
        ...typography.subhead,
        color: colors.text,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    matchConnector: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.md,
        paddingHorizontal: spacing.xl,
    },
    connectorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(233, 69, 96, 0.2)',
    },
    connectorHeart: {
        marginHorizontal: spacing.sm,
        opacity: 0.8,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    chatButton: {
        flex: 1,
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...shadows.md,
    },
    chatButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
    },
    chatButtonText: {
        ...typography.headline,
        color: colors.text,
    },
    dismissButton: {
        flex: 1,
        borderRadius: radius.lg,
        backgroundColor: colors.background, // Flat dark background
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Removed border style since it's now on modalContainer
    // border: { ... }
    dismissButtonText: {
        ...typography.headline,
        color: colors.textSecondary,
    },
});
