import { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import type { ResponseWithQuestion, UpdateResponseResult } from "../../store";
import { useResponsesStore } from "../../store";
import type { AnswerType } from "@/types";
import { colors, spacing, typography, radius } from "../../theme";
import { DeleteMatchConfirmModal } from "./DeleteMatchConfirmModal";

// Premium color palette
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = "rgba(212, 175, 55, ";

// Answer button config
const ANSWER_CONFIG = {
    yes: {
        color: colors.success,
        rgba: "rgba(46, 204, 113, ",
        icon: "checkmark-circle" as const,
        label: "Yes",
    },
    maybe: {
        color: colors.warning,
        rgba: "rgba(243, 156, 18, ",
        icon: "help-circle" as const,
        label: "Maybe",
    },
    no: {
        color: colors.error,
        rgba: "rgba(231, 76, 60, ",
        icon: "close-circle" as const,
        label: "No",
    },
};

interface EditResponseSheetProps {
    visible: boolean;
    response: ResponseWithQuestion | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function EditResponseSheet({ visible, response, onClose, onSuccess }: EditResponseSheetProps) {
    const { updateResponse } = useResponsesStore();
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAnswer, setPendingAnswer] = useState<AnswerType | null>(null);
    const [confirmModalData, setConfirmModalData] = useState<{
        matchId: string;
        messageCount: number;
    } | null>(null);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setIsLoading(false);
            setPendingAnswer(null);
            setConfirmModalData(null);
        }
    }, [visible]);

    if (!response) return null;

    const handleAnswerPress = async (newAnswer: AnswerType) => {
        if (newAnswer === response.answer || isLoading) return;

        setIsLoading(true);
        setPendingAnswer(newAnswer);

        const result = await updateResponse(response.question_id, newAnswer, false);

        if (result.requires_confirmation && result.match_id) {
            // Show confirmation modal
            setConfirmModalData({
                matchId: result.match_id,
                messageCount: result.message_count || 0,
            });
            setIsLoading(false);
        } else if (result.success) {
            // Success - close sheet
            setIsLoading(false);
            onSuccess();
            onClose();
        } else {
            // Error
            setIsLoading(false);
            setPendingAnswer(null);
            // Could show an error toast here
            console.error("Failed to update response:", result.error);
        }
    };

    const handleConfirmDelete = async () => {
        if (!pendingAnswer) return;

        setIsLoading(true);
        setConfirmModalData(null);

        const result = await updateResponse(response.question_id, pendingAnswer, true);

        setIsLoading(false);

        if (result.success) {
            onSuccess();
            onClose();
        } else {
            setPendingAnswer(null);
            console.error("Failed to delete match:", result.error);
        }
    };

    const handleCancelDelete = () => {
        setConfirmModalData(null);
        setPendingAnswer(null);
    };

    const AnswerButton = ({ answer }: { answer: AnswerType }) => {
        const config = ANSWER_CONFIG[answer];
        const isSelected = response.answer === answer;
        const isPending = pendingAnswer === answer;

        return (
            <TouchableOpacity
                style={[
                    styles.answerButton,
                    isSelected && {
                        backgroundColor: `${config.rgba}0.2)`,
                        borderColor: `${config.rgba}0.4)`,
                    },
                ]}
                onPress={() => handleAnswerPress(answer)}
                disabled={isLoading}
                activeOpacity={0.7}
            >
                {isPending && isLoading ? (
                    <ActivityIndicator color={config.color} size="small" />
                ) : (
                    <Ionicons
                        name={config.icon}
                        size={28}
                        color={isSelected ? config.color : colors.textSecondary}
                    />
                )}
                <Text
                    style={[
                        styles.answerButtonText,
                        isSelected && { color: config.color, fontWeight: "700" },
                    ]}
                >
                    {config.label}
                </Text>
                {isSelected && (
                    <View style={styles.selectedIndicator}>
                        <Ionicons name="checkmark" size={14} color={config.color} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Animated.View style={styles.overlay} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={styles.sheetContainer}
                    entering={SlideInDown.springify().damping(20)}
                    exiting={SlideOutDown.duration(200)}
                >
                    {Platform.OS === "ios" ? (
                        <BlurView intensity={80} tint="dark" style={styles.sheet}>
                            <SheetContent
                                response={response}
                                AnswerButton={AnswerButton}
                                onClose={onClose}
                            />
                        </BlurView>
                    ) : (
                        <View style={[styles.sheet, styles.sheetAndroid]}>
                            <SheetContent
                                response={response}
                                AnswerButton={AnswerButton}
                                onClose={onClose}
                            />
                        </View>
                    )}
                </Animated.View>
            </Animated.View>

            {/* Confirmation Modal */}
            <DeleteMatchConfirmModal
                visible={confirmModalData !== null}
                messageCount={confirmModalData?.messageCount || 0}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </Modal>
    );
}

// Sheet content extracted for reuse between iOS blur and Android solid background
function SheetContent({
    response,
    AnswerButton,
    onClose,
}: {
    response: ResponseWithQuestion;
    AnswerButton: React.FC<{ answer: AnswerType }>;
    onClose: () => void;
}) {
    return (
        <>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Edit Answer</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Question text */}
            <View style={styles.questionContainer}>
                <Text style={styles.questionText}>{response.question.text}</Text>
                <View style={styles.packBadge}>
                    <Ionicons name="layers-outline" size={12} color={colors.textTertiary} />
                    <Text style={styles.packText}>{response.question.pack.name}</Text>
                </View>
            </View>

            {/* Warning for matched questions */}
            {response.has_match && (
                <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={16} color={colors.warning} />
                    <Text style={styles.warningText}>
                        This question has a match. Changing to "No" will delete the match and
                        all messages.
                    </Text>
                </View>
            )}

            {/* Answer buttons */}
            <View style={styles.answerButtons}>
                <AnswerButton answer="yes" />
                <AnswerButton answer="maybe" />
                <AnswerButton answer="no" />
            </View>

            {/* Bottom padding for safe area */}
            <View style={styles.bottomPadding} />
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    sheetContainer: {
        maxHeight: "80%",
    },
    sheet: {
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        overflow: "hidden",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    sheetAndroid: {
        backgroundColor: colors.backgroundLight,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: spacing.md,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
    },
    headerTitle: {
        ...typography.title3,
        color: colors.text,
    },
    closeButton: {
        position: "absolute",
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    questionContainer: {
        marginBottom: spacing.lg,
    },
    questionText: {
        ...typography.body,
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    packBadge: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
    },
    packText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    warningBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "rgba(243, 156, 18, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(243, 156, 18, 0.2)",
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    warningText: {
        ...typography.footnote,
        color: colors.warning,
        flex: 1,
    },
    answerButtons: {
        flexDirection: "row",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    answerButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        gap: spacing.xs,
    },
    answerButtonText: {
        ...typography.callout,
        color: colors.textSecondary,
        fontWeight: "600",
    },
    selectedIndicator: {
        position: "absolute",
        top: spacing.sm,
        right: spacing.sm,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    bottomPadding: {
        height: Platform.OS === "ios" ? 34 : 20,
    },
});
