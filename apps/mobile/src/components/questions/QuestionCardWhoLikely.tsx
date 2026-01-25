import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
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

const AVATAR_SIZE = 72;
const AVATAR_OVERHANG_PERCENT = 0.5; // 50% of avatar hangs below the card
const actionButtonOffset = AVATAR_SIZE * AVATAR_OVERHANG_PERCENT;

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

export interface QuestionCardWhoLikelyProps {
    question: {
        id: string;
        text: string;
        intensity: number;
    };
    packInfo?: { name: string; icon: string; color?: string } | null;
    user: {
        id: string;
        name?: string;
        avatar_url?: string | null;
    };
    partner: {
        id: string;
        name?: string;
        avatar_url?: string | null;
    };
    onAnswer: (responseData: { type: 'who_likely'; chosen_user_id: string }) => void;
    onSkip?: () => void;
    onReport?: () => void;
}

// Get initials from name
function getInitials(name?: string): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function QuestionCardWhoLikely({ question, packInfo, user, partner, onAnswer, onSkip, onReport }: QuestionCardWhoLikelyProps) {
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

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

    const handleAvatarPress = async (userId: string) => {
        await triggerHaptic('medium');
        setSelectedId(userId);
        // Brief delay to show selection before triggering answer
        setTimeout(() => {
            onAnswer({ type: 'who_likely', chosen_user_id: userId });
        }, 200);
    };

    const handleSkipPress = async () => {
        await triggerHaptic('light');
        onSkip?.();
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
                        style={[styles.gradientContainer, { backgroundColor: packInfo?.color || colors.background }]}
                    >
                        <CardContent
                            question={question}
                            packInfo={packInfo}
                            user={user}
                            partner={partner}
                            selectedId={selectedId}
                            onAvatarPress={handleAvatarPress}
                            onSkipPress={handleSkipPress}
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
    user,
    partner,
    selectedId,
    onAvatarPress,
    onSkipPress,
    onFeedbackPress,
    onSharePress,
}: {
    question: QuestionCardWhoLikelyProps['question'];
    packInfo?: { name: string; icon: string; color?: string } | null;
    user: QuestionCardWhoLikelyProps['user'];
    partner: QuestionCardWhoLikelyProps['partner'];
    selectedId: string | null;
    onAvatarPress: (userId: string) => void;
    onSkipPress: () => void;
    onFeedbackPress: () => void;
    onSharePress: () => void;
}) {
    return (
        <View style={styles.cardInner}>
            {/* Header Row */}
            <View style={styles.headerRow}>
                {packInfo && (
                    <View style={styles.packBadge}>
                        <Ionicons name={packInfo.icon as any} size={14} color={colors.text} />
                        <Text style={styles.packBadgeText} numberOfLines={1}>
                            {packInfo.name}
                        </Text>
                    </View>
                )}
                {!packInfo && <View style={styles.headerSpacer} />}

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

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.text}>
                    {question.text}
                </Text>
            </View>

            {/* Footer - Avatar Buttons */}
            <View style={styles.footer}>
                <View style={styles.avatarContainer}>
                    <AvatarButton
                        userId={user.id}
                        name={user.name}
                        avatarUrl={user.avatar_url}
                        isSelected={selectedId === user.id}
                        onPress={onAvatarPress}
                    />
                    <TouchableOpacity
                        style={styles.skipButtonCenter}
                        onPress={onSkipPress}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                    <AvatarButton
                        userId={partner.id}
                        name={partner.name}
                        avatarUrl={partner.avatar_url}
                        isSelected={selectedId === partner.id}
                        onPress={onAvatarPress}
                    />
                </View>
            </View>
        </View>
    );
}

function AvatarButton({
    userId,
    name,
    avatarUrl,
    isSelected,
    onPress,
}: {
    userId: string;
    name?: string;
    avatarUrl?: string | null;
    isSelected: boolean;
    onPress: (userId: string) => void;
}) {
    const buttonScale = useSharedValue(1);
    const buttonGlow = useSharedValue(0);

    // Animate selection
    useEffect(() => {
        if (isSelected) {
            buttonScale.value = withSequence(
                withSpring(1.1, animations.springBouncy),
                withSpring(1.05, animations.spring)
            );
            buttonGlow.value = withTiming(1, { duration: 200 });
        } else {
            buttonScale.value = withSpring(1, animations.spring);
            buttonGlow.value = withTiming(0, { duration: 200 });
        }
    }, [isSelected]);

    const handlePressIn = () => {
        if (!isSelected) {
            buttonScale.value = withSpring(0.95, animations.spring);
            buttonGlow.value = withTiming(0.5, { duration: 100 });
        }
    };

    const handlePressOut = () => {
        if (!isSelected) {
            buttonScale.value = withSpring(1, animations.spring);
            buttonGlow.value = withTiming(0, { duration: 150 });
        }
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
        shadowOpacity: interpolate(buttonGlow.value, [0, 1], [0.2, 0.6]),
        shadowRadius: interpolate(buttonGlow.value, [0, 1], [8, 20]),
    }));

    const borderAnimatedStyle = useAnimatedStyle(() => ({
        borderWidth: interpolate(buttonGlow.value, [0, 1], [3, 4]),
        borderColor: colors.text, // Solid white border
    }));

    return (
        <TouchableOpacity
            onPress={() => onPress(userId)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            style={styles.avatarButtonWrapper}
        >
            <Animated.View style={[
                styles.avatarButton,
                buttonAnimatedStyle,
                { shadowColor: colors.text }
            ]}>
                <Animated.View style={[styles.avatarBorder, borderAnimatedStyle]}>
                    {avatarUrl ? (
                        <Image
                            source={{ uri: avatarUrl }}
                            style={styles.avatarImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={200}
                        />
                    ) : (
                        <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitials}>
                                {getInitials(name)}
                            </Text>
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        width: "90%",
        maxWidth: 400,
        flex: 1,
        maxHeight: 580 - actionButtonOffset, // Account for avatar overhang
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
    // Footer styles
    footer: {
        paddingTop: spacing.md,
        transform: [{ translateY: actionButtonOffset }],
    },
    avatarContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: spacing.lg,
    },
    avatarButtonWrapper: {
        alignItems: 'center',
    },
    avatarButton: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
    },
    avatarBorder: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        borderWidth: 3,
        borderColor: colors.text,
    },
    avatarImage: {
        width: AVATAR_SIZE - 6, // Account for border width (3px each side)
        height: AVATAR_SIZE - 6,
        borderRadius: (AVATAR_SIZE - 6) / 2,
    },
    avatarFallback: {
        width: AVATAR_SIZE - 6,
        height: AVATAR_SIZE - 6,
        borderRadius: (AVATAR_SIZE - 6) / 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
    },
    avatarInitials: {
        ...typography.title1,
        color: colors.text,
        fontWeight: 'bold',
    },
    skipButtonCenter: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: 30, // Align above center of 72px avatars
    },
    skipText: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
    },
});
