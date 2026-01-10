import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { colors, spacing, radius, typography } from '../../theme';
import type { IntensityLevel } from '@/types';

export interface IntensitySliderProps {
    value: IntensityLevel;
    onValueChange: (value: IntensityLevel) => void;
    disabled?: boolean;
    /** Partner's intensity level (shows as a ghost indicator) */
    partnerValue?: IntensityLevel | null;
    /** Partner's name for the mismatch message */
    partnerName?: string;
    /** Partner's avatar URL */
    partnerAvatar?: string | null;
}

const INTENSITY_LEVELS: Array<{ level: IntensityLevel; label: string; emoji: string; description: string }> = [
    { level: 1, label: 'Gentle', emoji: '💭', description: 'Pure emotional connection & non-sexual bonding' },
    { level: 2, label: 'Warm', emoji: '💕', description: 'Romantic atmosphere & affectionate touch' },
    { level: 3, label: 'Playful', emoji: '😏', description: 'Light sexual exploration & sensual discovery' },
    { level: 4, label: 'Steamy', emoji: '🔥', description: 'Explicit sexual activities & moderate adventure' },
    { level: 5, label: 'Intense', emoji: '🌶️', description: 'Advanced/BDSM/Extreme exploration' },
];

const HEAT_COLORS = [
    '#9b59b6', // Purple - gentle
    '#e94560', // Rose - warm
    '#ff6b6b', // Coral - playful
    '#ff4757', // Red - steamy
    '#ff3333', // Bright red - intense
];

const triggerHaptic = async () => {
    if (Platform.OS === 'web') return;
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export function IntensitySlider({
    value,
    onValueChange,
    disabled = false,
    partnerValue,
    partnerName,
    partnerAvatar,
}: IntensitySliderProps) {
    const current = INTENSITY_LEVELS[value - 1] ?? INTENSITY_LEVELS[1];
    const progress = useSharedValue((value - 1) / 4);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const hasPartner = partnerValue != null;
    const partnerLevel = hasPartner ? INTENSITY_LEVELS[partnerValue - 1] : null;
    const levelsDiffer = hasPartner && value !== partnerValue;
    const userIsHigher = hasPartner && value > partnerValue;
    const displayPartnerName = partnerName || 'Your partner';

    useEffect(() => {
        progress.value = withSpring((value - 1) / 4, { damping: 15, stiffness: 150 });
    }, [value]);

    const handleSelect = async (nextValue: IntensityLevel) => {
        if (disabled || nextValue === value) return;
        await triggerHaptic();
        onValueChange(nextValue);
    };

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const getMismatchMessage = () => {
        if (!levelsDiffer || !partnerLevel) return null;
        if (userIsHigher) {
            return `${displayPartnerName} is at ${partnerLevel.label} — tap for details`;
        }
        return `${displayPartnerName} is at ${partnerLevel.label}`;
    };

    return (
        <View style={[styles.container, disabled && styles.containerDisabled]}>
            {/* Progress track */}
            <View style={styles.trackContainer}>
                <View style={styles.track}>
                    <Animated.View style={[styles.progressFill, progressStyle]}>
                        <LinearGradient
                            colors={['#9b59b6', HEAT_COLORS[value - 1]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                </View>
            </View>

            {/* Level indicators */}
            <View style={styles.levelsRow}>
                {INTENSITY_LEVELS.map((level) => {
                    const isSelected = value === level.level;
                    const isPassed = value > level.level;
                    const isActive = isSelected || isPassed;
                    const isPartnerLevel = hasPartner && partnerValue === level.level;

                    return (
                        <Pressable
                            key={level.level}
                            style={styles.levelButton}
                            onPress={() => handleSelect(level.level)}
                            disabled={disabled}
                        >
                            <View style={styles.indicatorWrapper}>
                                {/* Partner indicator ring */}
                                {isPartnerLevel && !isSelected && (
                                    <View style={styles.partnerRing}>
                                        {partnerAvatar ? (
                                            <Image
                                                source={{ uri: partnerAvatar }}
                                                style={styles.partnerAvatarSmall}
                                            />
                                        ) : (
                                            <Ionicons name="heart" size={8} color={colors.secondary} />
                                        )}
                                    </View>
                                )}
                                <View style={[
                                    styles.levelIndicator,
                                    isActive && styles.levelIndicatorActive,
                                    isSelected && {
                                        backgroundColor: HEAT_COLORS[level.level - 1],
                                        borderColor: HEAT_COLORS[level.level - 1],
                                    },
                                    isPartnerLevel && !isSelected && styles.levelIndicatorPartner,
                                ]}>
                                    {isSelected ? (
                                        <Text style={styles.levelEmoji}>{level.emoji}</Text>
                                    ) : (
                                        <Ionicons
                                            name={isActive ? 'flame' : 'flame-outline'}
                                            size={16}
                                            color={isActive ? colors.text : colors.textTertiary}
                                        />
                                    )}
                                </View>
                            </View>
                            <Text style={[
                                styles.levelLabel,
                                isSelected && styles.levelLabelActive,
                                isPartnerLevel && !isSelected && styles.levelLabelPartner,
                            ]}>
                                {level.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Current level card */}
            <View style={[styles.currentCard, levelsDiffer && userIsHigher && styles.currentCardWarning]}>
                <View style={styles.currentHeader}>
                    <Text style={styles.currentEmoji}>{current.emoji}</Text>
                    <Text style={styles.currentLabel}>{current.label}</Text>
                    {hasPartner && !levelsDiffer && (
                        <Pressable
                            style={styles.matchBadge}
                            onPress={() => setShowInfoModal(true)}
                        >
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                            <Text style={styles.matchBadgeText}>Matched</Text>
                            <Ionicons name="information-circle-outline" size={12} color={colors.success} style={{ marginLeft: 2 }} />
                        </Pressable>
                    )}
                </View>
                <Text style={styles.currentDescription}>{current.description}</Text>

                {/* Mismatch message */}
                {levelsDiffer && (
                    <Pressable
                        style={styles.mismatchRow}
                        onPress={() => setShowInfoModal(true)}
                    >
                        {partnerAvatar ? (
                            <Image source={{ uri: partnerAvatar }} style={styles.partnerAvatarTiny} />
                        ) : (
                            <View style={styles.partnerIconTiny}>
                                <Ionicons name="person" size={10} color={colors.secondary} />
                            </View>
                        )}
                        <Text style={[
                            styles.mismatchText,
                            userIsHigher && styles.mismatchTextWarning,
                        ]}>
                            {getMismatchMessage()}
                        </Text>
                        <Ionicons
                            name="chevron-forward"
                            size={14}
                            color={userIsHigher ? colors.warning : colors.textSecondary}
                        />
                    </Pressable>
                )}
            </View>

            {/* Info Modal */}
            <Modal
                visible={showInfoModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowInfoModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowInfoModal(false)}
                >
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        {Platform.OS === 'ios' ? (
                            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                        ) : null}
                        <View style={styles.modalInner}>
                            {/* Header */}
                            <View style={styles.modalHeader}>
                                {levelsDiffer ? (
                                    <LinearGradient
                                        colors={userIsHigher ? ['#F39C12', '#E67E22'] : [colors.secondary, colors.primary]}
                                        style={styles.modalIconGradient}
                                    >
                                        <Ionicons
                                            name={userIsHigher ? "alert-circle" : "information-circle"}
                                            size={28}
                                            color={colors.text}
                                        />
                                    </LinearGradient>
                                ) : (
                                    <LinearGradient
                                        colors={[colors.success, '#27AE60']}
                                        style={styles.modalIconGradient}
                                    >
                                        <Ionicons name="heart" size={28} color={colors.text} />
                                    </LinearGradient>
                                )}
                                <Text style={styles.modalTitle}>
                                    {levelsDiffer
                                        ? (userIsHigher ? "Different Comfort Zones" : "You're in Sync")
                                        : "You're Perfectly Matched"
                                    }
                                </Text>
                            </View>

                            {/* Comparison visual */}
                            {hasPartner && (
                                <View style={styles.comparisonContainer}>
                                    <View style={styles.comparisonPerson}>
                                        <View style={[styles.comparisonAvatar, { backgroundColor: HEAT_COLORS[value - 1] }]}>
                                            <Text style={styles.comparisonEmoji}>{current.emoji}</Text>
                                        </View>
                                        <Text style={styles.comparisonName}>You</Text>
                                        <Text style={styles.comparisonLevel}>{current.label}</Text>
                                    </View>

                                    <View style={styles.comparisonDivider}>
                                        <Ionicons
                                            name={levelsDiffer ? "swap-horizontal" : "heart"}
                                            size={20}
                                            color={levelsDiffer ? colors.textTertiary : colors.success}
                                        />
                                    </View>

                                    <View style={styles.comparisonPerson}>
                                        {partnerAvatar ? (
                                            <Image source={{ uri: partnerAvatar }} style={styles.comparisonAvatarImage} />
                                        ) : (
                                            <View style={[styles.comparisonAvatar, { backgroundColor: HEAT_COLORS[(partnerValue ?? 1) - 1] }]}>
                                                <Text style={styles.comparisonEmoji}>{partnerLevel?.emoji}</Text>
                                            </View>
                                        )}
                                        <Text style={styles.comparisonName}>{displayPartnerName}</Text>
                                        <Text style={styles.comparisonLevel}>{partnerLevel?.label}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Explanation */}
                            <View style={styles.modalExplanation}>
                                {!levelsDiffer ? (
                                    <>
                                        <Text style={styles.modalText}>
                                            You and {displayPartnerName} have the same comfort zone setting.
                                            You'll both see the same question packs and can match on everything!
                                        </Text>
                                        <View style={styles.modalTip}>
                                            <Ionicons name="sparkles" size={16} color={colors.success} />
                                            <Text style={styles.modalTipText}>
                                                Perfect alignment means more matches
                                            </Text>
                                        </View>
                                    </>
                                ) : userIsHigher ? (
                                    <>
                                        <Text style={styles.modalText}>
                                            Your comfort zone is set higher than {displayPartnerName}'s.
                                            This means some questions you see won't appear for them.
                                        </Text>
                                        <View style={[styles.modalTip, styles.modalTipWarning]}>
                                            <Ionicons name="information-circle" size={16} color={colors.warning} />
                                            <Text style={[styles.modalTipText, styles.modalTipTextWarning]}>
                                                Swipes on {current.label} content won't match since {displayPartnerName} is at {partnerLevel?.label}
                                            </Text>
                                        </View>
                                        <Text style={styles.modalSubtext}>
                                            Consider aligning your levels, or enjoy different paces — it's your choice!
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.modalText}>
                                            {displayPartnerName}'s comfort zone is higher than yours.
                                            They might swipe on questions you don't see.
                                        </Text>
                                        <View style={styles.modalTip}>
                                            <Ionicons name="shield-checkmark" size={16} color={colors.secondary} />
                                            <Text style={styles.modalTipText}>
                                                You'll only see content within your comfort zone
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            {/* Close button */}
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowInfoModal(false)}
                            >
                                <Text style={styles.modalCloseText}>Got it</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: spacing.md,
    },
    containerDisabled: {
        opacity: 0.6,
    },
    trackContainer: {
        paddingHorizontal: spacing.lg,
    },
    track: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
    },
    levelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xs,
    },
    levelButton: {
        alignItems: 'center',
        flex: 1,
    },
    indicatorWrapper: {
        position: 'relative',
        marginBottom: spacing.xs,
    },
    levelIndicator: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    levelIndicatorActive: {
        backgroundColor: 'rgba(233, 69, 96, 0.15)',
        borderColor: 'rgba(233, 69, 96, 0.3)',
    },
    levelIndicatorPartner: {
        borderColor: colors.secondary,
        borderStyle: 'dashed',
    },
    partnerRing: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        borderWidth: 2,
        borderColor: colors.backgroundLight,
    },
    partnerAvatarSmall: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    levelEmoji: {
        fontSize: 16,
    },
    levelLabel: {
        ...typography.caption2,
        color: colors.textTertiary,
        textAlign: 'center',
    },
    levelLabelActive: {
        color: colors.text,
        fontWeight: '600',
    },
    levelLabelPartner: {
        color: colors.secondary,
    },
    currentCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    currentCardWarning: {
        borderColor: 'rgba(243, 156, 18, 0.3)',
        backgroundColor: 'rgba(243, 156, 18, 0.05)',
    },
    currentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    currentEmoji: {
        fontSize: 20,
    },
    currentLabel: {
        ...typography.subhead,
        fontWeight: '600',
        color: colors.text,
    },
    matchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 'auto',
        backgroundColor: 'rgba(46, 204, 113, 0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
    },
    matchBadgeText: {
        ...typography.caption2,
        color: colors.success,
        fontWeight: '600',
    },
    currentDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    mismatchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    partnerAvatarTiny: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    partnerIconTiny: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(155, 89, 182, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mismatchText: {
        ...typography.caption1,
        color: colors.textSecondary,
        flex: 1,
    },
    mismatchTextWarning: {
        color: colors.warning,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.backgroundLight,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalInner: {
        padding: spacing.lg,
        backgroundColor: Platform.OS === 'ios' ? 'rgba(26, 26, 46, 0.85)' : 'transparent',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalIconGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        ...typography.title3,
        color: colors.text,
        textAlign: 'center',
    },
    comparisonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    comparisonPerson: {
        alignItems: 'center',
        flex: 1,
    },
    comparisonAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    comparisonAvatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginBottom: spacing.xs,
    },
    comparisonEmoji: {
        fontSize: 24,
    },
    comparisonName: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '600',
    },
    comparisonLevel: {
        ...typography.caption2,
        color: colors.textSecondary,
    },
    comparisonDivider: {
        width: 40,
        alignItems: 'center',
    },
    modalExplanation: {
        marginBottom: spacing.lg,
    },
    modalText: {
        ...typography.subhead,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.md,
    },
    modalSubtext: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    modalTip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    modalTipWarning: {
        backgroundColor: 'rgba(243, 156, 18, 0.1)',
    },
    modalTipText: {
        ...typography.caption1,
        color: colors.success,
        flex: 1,
    },
    modalTipTextWarning: {
        color: colors.warning,
    },
    modalCloseButton: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    modalCloseText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: '600',
    },
});

export default IntensitySlider;
