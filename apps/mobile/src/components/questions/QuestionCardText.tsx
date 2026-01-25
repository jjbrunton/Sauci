import { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Platform,
    TouchableOpacity,
    TextInput,
    Keyboard,
    TouchableWithoutFeedback,
} from "react-native";
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

const MAX_TEXT_LENGTH = 500;

export interface QuestionCardTextProps {
    question: {
        id: string;
        text: string;
        intensity: number;
        partner_text?: string | null;
        partner_answered?: boolean;
    };
    packInfo?: { name: string; icon: string; color?: string } | null;
    onAnswer: (answer: 'yes' | 'no' | 'skip', responseData?: { type: 'text_answer'; text: string }) => void;
    onReport?: () => void;
}

export default function QuestionCardText({ question, packInfo, onAnswer, onReport }: QuestionCardTextProps) {
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [textValue, setTextValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

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
        Keyboard.dismiss();
        await triggerHaptic(answer === 'skip' ? 'light' : 'medium');
        if (answer === 'yes' && textValue.trim().length > 0) {
            onAnswer(answer, { type: 'text_answer', text: textValue.trim() });
        } else {
            onAnswer(answer);
        }
    };

    const handleFeedbackPress = () => {
        if (onReport) {
            onReport();
        } else {
            setShowFeedbackModal(true);
        }
    };

    const isYesDisabled = textValue.trim().length === 0;

    return (
        <>
            <Animated.View
                entering={FadeInDown.duration(400).springify()}
                style={styles.cardWrapper}
            >
                <Animated.View style={[styles.cardOuter, animatedStyle, shadows.lg, { shadowColor: colors.primary }]}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                        <View
                            style={[
                                styles.gradientContainer, 
                                { backgroundColor: packInfo?.color || colors.background }
                            ]}
                        >
                            <CardContent
                                question={question}
                                packInfo={packInfo}
                                textValue={textValue}
                                setTextValue={setTextValue}
                                isFocused={isFocused}
                                setIsFocused={setIsFocused}
                                isYesDisabled={isYesDisabled}
                                handleButtonPress={handleButtonPress}
                                onFeedbackPress={handleFeedbackPress}
                                onSharePress={handleSharePress}
                            />
                        </View>
                    </TouchableWithoutFeedback>
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
    textValue,
    setTextValue,
    isFocused,
    setIsFocused,
    isYesDisabled,
    handleButtonPress,
    onFeedbackPress,
    onSharePress,
}: {
    question: QuestionCardTextProps['question'];
    packInfo?: { name: string; icon: string } | null;
    textValue: string;
    setTextValue: (value: string) => void;
    isFocused: boolean;
    setIsFocused: (focused: boolean) => void;
    isYesDisabled: boolean;
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

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.text}>
                    {question.text}
                </Text>

                {/* Text Input Area - Glass style */}
                <View style={[
                    styles.inputContainer,
                    isFocused && styles.inputContainerFocused
                ]}>
                    <TextInput
                        style={styles.textInput}
                        value={textValue}
                        onChangeText={(text) => setTextValue(text.slice(0, MAX_TEXT_LENGTH))}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Type your answer..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        multiline
                        textAlignVertical="top"
                        maxLength={MAX_TEXT_LENGTH}
                    />
                    <View style={styles.charCountContainer}>
                        <Text style={[
                            styles.charCount,
                            textValue.length >= MAX_TEXT_LENGTH && styles.charCountMax
                        ]}>
                            {textValue.length}/{MAX_TEXT_LENGTH}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Footer - Action Buttons */}
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
                        disabled={isYesDisabled}
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
    disabled = false,
}: {
    onPress: () => void;
    icon: string;
    iconColor: string;
    label: string;
    disabled?: boolean;
}) {
    const buttonScale = useSharedValue(1);

    const handlePressIn = () => {
        if (disabled) return;
        buttonScale.value = withSpring(0.92, animations.spring);
    };

    const handlePressOut = () => {
        if (disabled) return;
        buttonScale.value = withSpring(1, animations.spring);
    };

    const handlePress = () => {
        if (disabled) return;
        onPress();
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    return (
        <TouchableOpacity
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={disabled ? 1 : 1}
            disabled={disabled}
            style={styles.actionButtonWrapper}
        >
            <Animated.View style={[
                styles.actionButton,
                buttonAnimatedStyle,
                { backgroundColor: actionButtonBackground }
            ]}>
                <Ionicons
                    name={icon as any}
                    size={32}
                    color={iconColor}
                    style={[styles.buttonIcon, disabled && { opacity: 0.4 }]}
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
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: spacing.sm,
    },
    text: {
        ...typography.title2,
        color: colors.text,
        textAlign: "center",
        lineHeight: 30,
        marginBottom: spacing.lg,
    },
    // Glass-style input
    inputContainer: {
        width: '100%',
        flex: 1,
        minHeight: 100,
        maxHeight: 180,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        padding: spacing.md,
    },
    inputContainerFocused: {
        borderColor: 'rgba(255,255,255,0.4)',
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    textInput: {
        flex: 1,
        ...typography.body,
        color: colors.text,
        textAlignVertical: 'top',
    },
    charCountContainer: {
        alignItems: 'flex-end',
        marginTop: spacing.xs,
    },
    charCount: {
        ...typography.caption2,
        color: 'rgba(255,255,255,0.5)',
    },
    charCountMax: {
        color: colors.error,
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
