import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity, Image } from "react-native";
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
    FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadows, typography, spacing, animations } from "../../theme";
import { useMediaPicker } from "../../hooks/useMediaPicker";
import { SharePreviewModal } from "../share";

const ACTION_BUTTON_SIZE = 72;
const ACTION_BUTTON_OVERHANG_PERCENT = 0.5;
const actionButtonOffset = ACTION_BUTTON_SIZE * ACTION_BUTTON_OVERHANG_PERCENT;
const actionButtonBackground = colors.muted;

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

export interface QuestionCardPhotoProps {
    question: {
        id: string;
        text: string;
        intensity: number;
        partner_text?: string | null;
        partner_answered?: boolean;
    };
    packInfo?: { name: string; icon: string; color?: string } | null;
    onAnswer: (answer: 'yes' | 'skip', responseData?: { type: 'photo'; media_path: string }) => void;
    onReport?: () => void;
}

export default function QuestionCardPhoto({ question, packInfo, onAnswer, onReport }: QuestionCardPhotoProps) {
    const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);

    const { takePhoto, pickMedia } = useMediaPicker({ imageQuality: 0.8 });

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

    const handleTakePhoto = async () => {
        await triggerHaptic('light');
        const result = await takePhoto();
        if (result) {
            setSelectedPhotoUri(result.uri);
        }
    };

    const handlePickFromLibrary = async () => {
        await triggerHaptic('light');
        const result = await pickMedia();
        if (result && result.mediaType === 'image') {
            setSelectedPhotoUri(result.uri);
        }
    };

    const handleConfirm = async () => {
        if (!selectedPhotoUri) return;
        await triggerHaptic('medium');
        onAnswer('yes', { type: 'photo', media_path: selectedPhotoUri });
    };

    const handleRetake = async () => {
        await triggerHaptic('light');
        setSelectedPhotoUri(null);
    };

    const handleCancel = async () => {
        await triggerHaptic('light');
        setSelectedPhotoUri(null);
    };

    const handleSkip = async () => {
        await triggerHaptic('light');
        onAnswer('skip');
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
                        {selectedPhotoUri ? (
                            <PhotoPreviewContent
                                question={question}
                                packInfo={packInfo}
                                photoUri={selectedPhotoUri}
                                onConfirm={handleConfirm}
                                onRetake={handleRetake}
                                onCancel={handleCancel}
                                onReport={onReport}
                            />
                        ) : (
                            <PhotoSelectContent
                                question={question}
                                packInfo={packInfo}
                                onTakePhoto={handleTakePhoto}
                                onPickFromLibrary={handlePickFromLibrary}
                                onSkip={handleSkip}
                                onReport={onReport}
                                onSharePress={handleSharePress}
                            />
                        )}
                    </View>
                </Animated.View>
            </Animated.View>

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

// State A - No photo selected
function PhotoSelectContent({
    question,
    packInfo,
    onTakePhoto,
    onPickFromLibrary,
    onSkip,
    onReport,
    onSharePress,
}: {
    question: QuestionCardPhotoProps['question'];
    packInfo?: { name: string; icon: string } | null;
    onTakePhoto: () => void;
    onPickFromLibrary: () => void;
    onSkip: () => void;
    onReport?: () => void;
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
                    {onReport && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onReport}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="flag-outline" size={20} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.text}>
                    {question.text}
                </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.photoButtonContainer}>
                    <PhotoActionButton
                        onPress={onPickFromLibrary}
                        icon="images"
                        label="Library"
                        colors={[colors.secondary, colors.secondaryDark]}
                    />
                    
                    <TouchableOpacity
                        style={styles.skipButtonCenter}
                        onPress={onSkip}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    <PhotoActionButton
                        onPress={onTakePhoto}
                        icon="camera"
                        label="Camera"
                        colors={gradients.primary as [string, string]}
                    />
                </View>
            </View>
        </View>
    );
}

// State B - Photo preview
function PhotoPreviewContent({
    question,
    packInfo,
    photoUri,
    onConfirm,
    onRetake,
    onCancel,
    onReport,
}: {
    question: QuestionCardPhotoProps['question'];
    packInfo?: { name: string; icon: string } | null;
    photoUri: string;
    onConfirm: () => void;
    onRetake: () => void;
    onCancel: () => void;
    onReport?: () => void;
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
                    {onReport && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onReport}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="flag-outline" size={20} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            <View style={styles.previewContent}>
                <Text style={styles.previewText} numberOfLines={2}>
                    {question.text}
                </Text>

                {/* Photo Preview */}
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.photoPreviewContainer}
                >
                    <Image
                        source={{ uri: photoUri }}
                        style={styles.photoPreview}
                        resizeMode="cover"
                    />
                    <View style={styles.photoPreviewBorder} pointerEvents="none" />
                </Animated.View>
            </View>

            {/* Footer */}
            <View style={styles.previewFooter}>
                <View style={styles.previewButtonRow}>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={onCancel}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <ConfirmButton onPress={onConfirm} />

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={onRetake}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.secondaryButtonText}>Retake</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

function PhotoActionButton({
    onPress,
    colors: _buttonColors,
    icon,
    label,
}: {
    onPress: () => void;
    colors: [string, string];
    icon: string;
    label: string;
}) {
    const buttonScale = useSharedValue(1);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.95, animations.spring);
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
            style={styles.photoActionWrapper}
        >
            <Animated.View style={[
                styles.photoActionButton,
                buttonAnimatedStyle,
                { backgroundColor: actionButtonBackground }
            ]}>
                <Ionicons
                    name={icon as any}
                    size={28}
                    color="white"
                    style={styles.buttonIcon}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

function ConfirmButton({ onPress }: { onPress: () => void }) {
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
        >
            <Animated.View style={[
                styles.confirmButton,
                buttonAnimatedStyle,
                { backgroundColor: colors.success }
            ]}>
                <LinearGradient
                    colors={gradients.success as [string, string]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <Ionicons
                    name="checkmark"
                    size={28}
                    color={colors.text}
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
    // Footer styles
    footer: {
        paddingTop: spacing.md,
        transform: [{ translateY: actionButtonOffset }],
    },
    previewFooter: {
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    photoButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        width: '100%',
        paddingHorizontal: spacing.md,
    },
    photoActionWrapper: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    photoActionButton: {
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
    buttonIcon: {
        zIndex: 1,
    },
    photoActionButtonLabel: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '600',
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
    // Preview state styles
    previewContent: {
        flex: 1,
        paddingTop: spacing.sm,
    },
    previewText: {
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    photoPreviewContainer: {
        flex: 1,
        marginBottom: spacing.sm,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    photoPreview: {
        width: '100%',
        height: '100%',
        borderRadius: radius.lg,
    },
    photoPreviewBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    previewButtonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    secondaryButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.xs,
    },
    secondaryButtonText: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.7)',
    },
    confirmButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
});
