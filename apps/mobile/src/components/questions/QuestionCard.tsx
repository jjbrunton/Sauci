import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    interpolate,
    Easing,
    FadeInDown,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadows, typography, spacing, animations } from "../../theme";
import { QuestionFeedbackModal } from "../feedback";
import { SharePreviewModal } from "../share";

const ACTION_BUTTON_SIZE = 72;
const ACTION_BUTTON_OVERHANG_PERCENT = 0.5; // 50% of button hangs below the card
const actionButtonOffset = ACTION_BUTTON_SIZE * ACTION_BUTTON_OVERHANG_PERCENT;
const actionButtonBackground = '#3a3a42';

// Haptics helper - not supported on web
const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (Platform.OS === 'web') return;
    const Haptics = await import('expo-haptics');
    const feedbackStyle = style === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : style === 'heavy'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Medium;
    await Haptics.impactAsync(feedbackStyle);
};

export interface QuestionCardProps {
    question: {
        id: string;
        text: string;
        intensity: number;
        partner_text?: string | null;
        is_two_part?: boolean;
        partner_answered?: boolean;
        question_type?: string;
    };
    packInfo?: { name: string; icon: string; color?: string } | null;
    onAnswer: (answer: 'yes' | 'no' | 'skip') => void;
    onReport?: () => void;
}

export default function QuestionCard({ question, packInfo, onAnswer, onReport }: QuestionCardProps) {
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const idleBreathing = useSharedValue(0);

    const handleSharePress = async () => {
        await triggerHaptic('light');
        setShowShareModal(true);
    };

    // Subtle idle breathing animation
    useEffect(() => {
        idleBreathing.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const idleOffset = interpolate(idleBreathing.value, [0, 1], [0, -4]);
        return {
            transform: [{ translateY: idleOffset }],
        };
    });

    const handleButtonPress = async (answer: 'yes' | 'no' | 'skip') => {
        await triggerHaptic(answer === 'skip' ? 'light' : 'medium');
        onAnswer(answer);
    };

    const handleFeedbackPress = () => {
        if (onReport) {
            onReport();
        } else {
            setShowFeedbackModal(true);
        }
    };

    return (
        <>
            <Animated.View
                entering={FadeInDown.duration(400).springify()}
                style={styles.cardWrapper}
            >
                <Animated.View style={[styles.cardOuter, animatedStyle, shadows.lg, { shadowColor: colors.primary }]}>
                    <View
                        style={[
                            styles.gradientContainer, 
                            { backgroundColor: packInfo?.color || colors.background }
                        ]}
                    >
                        <CardContent
                            question={question}
                            packInfo={packInfo}
                            handleButtonPress={handleButtonPress}
                            onFeedbackPress={handleFeedbackPress}
                            onSharePress={handleSharePress}
                        />
                    </View>
                </Animated.View>
            </Animated.View>

            <QuestionFeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
                questionId={question.id}
                questionText={question.text}
            />

            <SharePreviewModal
                visible={showShareModal}
                onClose={() => setShowShareModal(false)}
                question={question}
                packName={packInfo?.name}
                cardColor={packInfo?.color}
            />
        </>
    );
}

function CardContent({
    question,
    packInfo,
    handleButtonPress,
    onFeedbackPress,
    onSharePress,
}: {
    question: QuestionCardProps['question'];
    packInfo?: { name: string; icon: string } | null;
    handleButtonPress: (answer: 'yes' | 'no' | 'skip') => void;
    onFeedbackPress: () => void;
    onSharePress: () => void;
}) {
    return (
        <View style={styles.cardInner}>
            {/* Header Row - Pack badge and action buttons */}
            <View style={styles.headerRow}>
                {/* Pack Badge */}
                {packInfo && (
                    <View style={styles.packBadge}>
                        <Ionicons name={packInfo.icon as any} size={14} color={colors.text} />
                        <Text style={styles.packBadgeText} numberOfLines={1}>
                            {packInfo.name}
                        </Text>
                    </View>
                )}
                {!packInfo && <View style={styles.headerSpacer} />}

                {/* Action Buttons */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={onSharePress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={onFeedbackPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="flag-outline" size={20} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content - Question text centered */}
            <View style={styles.content}>
                <Text style={[styles.text, question.is_two_part && styles.twoPartText]}>
                    {question.text}
                </Text>

                {/* Partner's version of the question - only show when user is answering first */}
                {question.partner_text && !question.partner_answered && (
                    <View style={styles.partnerTextContainer}>
                        <View style={styles.partnerDivider}>
                            <View style={styles.partnerDividerLine} />
                            <View style={styles.partnerLabelContainer}>
                                <Ionicons name="swap-horizontal" size={12} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.partnerLabel}>Partner sees</Text>
                            </View>
                            <View style={styles.partnerDividerLine} />
                        </View>
                        <Text style={styles.partnerText}>{question.partner_text}</Text>
                    </View>
                )}
            </View>

            {/* Footer - Action Buttons pinned to bottom */}
            <View style={styles.footer}>
                <View style={styles.buttonContainer}>
                    <ActionButton
                        onPress={() => handleButtonPress("no")}
                        icon="close"
                        iconColor={colors.error}
                        label="NO"
                    />

                    {/* Skip button in between */}
                    <TouchableOpacity
                        style={styles.skipButtonCenter}
                        onPress={() => handleButtonPress("skip")}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    <ActionButton
                        onPress={() => handleButtonPress("yes")}
                        icon="checkmark"
                        iconColor={colors.success}
                        label="YES"
                    />
                </View>
            </View>
        </View>
    );
}

function ActionButton({
    onPress,
    icon,
    iconColor,
    label,
    small = false,
}: {
    onPress: () => void;
    icon: string;
    iconColor: string;
    label: string;
    small?: boolean;
}) {
    const buttonScale = useSharedValue(1);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, animations.spring);
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, animations.spring);
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            style={styles.actionButtonWrapper}
        >
            <Animated.View style={[
                styles.actionButton,
                small && styles.actionButtonSmall,
                buttonAnimatedStyle,
                { backgroundColor: actionButtonBackground }
            ]}>
                <Ionicons
                    name={icon as any}
                    size={small ? 20 : 32}
                    color={iconColor}
                    style={styles.buttonIcon}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        width: "90%",
        maxWidth: 400,
        flex: 1,
        maxHeight: 580 - actionButtonOffset, // Account for button overhang
    },
    cardOuter: {
        flex: 1,
        borderRadius: radius.xxl,
        overflow: "visible",
    },
    gradientContainer: {
        flex: 1,
        borderRadius: radius.xxl,
        overflow: "visible",
    },
    cardInner: {
        flex: 1,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    // Header row styles
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerSpacer: {
        flex: 1,
    },
    packBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.xs,
        maxWidth: '60%',
    },
    packBadgeText: {
        ...typography.caption1,
        fontWeight: '600',
        color: colors.text,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Content styles
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.sm,
    },
    text: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
        lineHeight: 36,
    },
    twoPartText: {
        ...typography.title2,
        lineHeight: 32,
    },
    partnerTextContainer: {
        marginTop: spacing.lg,
        width: '100%',
        paddingHorizontal: spacing.sm,
    },
    partnerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    partnerDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    partnerLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: radius.full,
        gap: spacing.xs,
    },
    partnerLabel: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    partnerText: {
        ...typography.subhead,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    // Footer styles
    footer: {
        paddingTop: spacing.md,
        transform: [{ translateY: actionButtonOffset }],
    },
    buttonContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        width: '100%',
        paddingHorizontal: spacing.md,
    },
    actionButtonWrapper: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    actionButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    actionButtonSmall: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    buttonIcon: {
        zIndex: 1,
    },
    skipButtonCenter: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: 30, // Align above center of 72px buttons
    },
    skipText: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
    },
});
