import { useState, useEffect, type ReactNode } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import type { ResponseWithQuestion } from "../../store";
import { useAuthStore, useResponsesStore } from "../../store";
import { useMediaPicker } from "../../hooks/useMediaPicker";
import { useResponseMediaUpload } from "../../hooks/useResponseMediaUpload";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import type { AnswerType, ResponseData } from "@/types";
import { colors, spacing, typography, radius } from "../../theme";
import { DeleteMatchConfirmModal } from "./DeleteMatchConfirmModal";

// Premium color palette
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = "rgba(212, 175, 55, ";
const MAX_TEXT_LENGTH = 500;

// Answer button config (includes 'maybe' for displaying existing responses)
const ANSWER_CONFIG = {
    yes: {
        color: colors.success,
        rgba: "rgba(46, 204, 113, ",
        icon: "checkmark-circle" as const,
        label: "Yes",
    },
    no: {
        color: colors.error,
        rgba: "rgba(231, 76, 60, ",
        icon: "close-circle" as const,
        label: "No",
    },
    maybe: {
        color: colors.warning,
        rgba: "rgba(243, 156, 18, ",
        icon: "help-circle" as const,
        label: "Maybe",
    },
};

// Only these answer types can be selected by users
type SelectableAnswerType = "yes" | "no";

interface EditResponseSheetProps {
    visible: boolean;
    response: ResponseWithQuestion | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function EditResponseSheet({ visible, response, onClose, onSuccess }: EditResponseSheetProps) {
    const { updateResponse } = useResponsesStore();
    const { user, partner } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAnswer, setPendingAnswer] = useState<AnswerType | null>(null);
    const [confirmModalData, setConfirmModalData] = useState<{
        matchId: string;
        messageCount: number;
    } | null>(null);
    const [textValue, setTextValue] = useState("");
    const [selectedWhoLikely, setSelectedWhoLikely] = useState<string | null>(null);

    const questionId = response?.question_id ?? "";
    const maxDurationSeconds = response?.question.config?.max_duration_seconds ?? 60;
    const { takePhoto, pickMedia } = useMediaPicker({ imageQuality: 0.8 });
    const { uploading, uploadPhoto, uploadAudio } = useResponseMediaUpload({
        userId: user?.id ?? "",
        questionId,
    });
    const {
        state: audioState,
        durationSeconds,
        recordingUri,
        startRecording,
        stopRecording,
        resetRecording,
    } = useAudioRecorder({ maxDurationSeconds });
    const isBusy = isLoading || uploading;

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setIsLoading(false);
            setPendingAnswer(null);
            setConfirmModalData(null);
            setTextValue("");
            setSelectedWhoLikely(null);
            resetRecording();
        }
    }, [visible, resetRecording]);

    useEffect(() => {
        if (!visible || !response) return;

        if (response.response_data?.type === "text_answer") {
            setTextValue(response.response_data.text);
        } else {
            setTextValue("");
        }

        if (response.response_data?.type === "who_likely") {
            setSelectedWhoLikely(response.response_data.chosen_user_id);
        } else {
            setSelectedWhoLikely(null);
        }
    }, [visible, response]);

    if (!response) return null;

    const handleAnswerPress = async (newAnswer: AnswerType, responseData?: ResponseData | null) => {
        if (isBusy) return;
        if (newAnswer === response.answer && typeof responseData === "undefined") return;

        setIsLoading(true);
        setPendingAnswer(newAnswer);

        const result = await updateResponse(response.question_id, newAnswer, false, responseData);

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

    const questionType = response.question.question_type ?? "swipe";
    const isTextSaveDisabled = textValue.trim().length === 0 || isBusy;
    const isNoSelected = response.answer === "no";
    const userLabel = user?.name || "You";
    const partnerLabel = partner?.name || "Partner";
    const canUpload = !!user?.id && !!questionId;

    const handleTextSave = async () => {
        const trimmed = textValue.trim();
        if (!trimmed) return;
        await handleAnswerPress("yes", { type: "text_answer", text: trimmed });
    };

    const handleSetNo = async () => {
        await handleAnswerPress("no", null);
    };

    const handleWhoLikelySelect = async (userId: string) => {
        if (isBusy) return;
        setSelectedWhoLikely(userId);
        await handleAnswerPress("yes", { type: "who_likely", chosen_user_id: userId });
    };

    const handlePhotoPick = async (source: "camera" | "library") => {
        if (isBusy || !canUpload) return;
        const result = source === "camera" ? await takePhoto() : await pickMedia();
        if (!result || result.mediaType !== "image") return;

        const uploadResult = await uploadPhoto(result.uri);
        if (!uploadResult.success || !uploadResult.mediaPath) {
            console.error("Failed to upload photo response:", uploadResult.error);
            return;
        }

        await handleAnswerPress("yes", { type: "photo", media_path: uploadResult.mediaPath });
    };

    const handleStartRecording = async () => {
        if (isBusy) return;
        await startRecording();
    };

    const handleStopRecording = async () => {
        if (isBusy) return;
        await stopRecording();
    };

    const handleAudioSave = async () => {
        if (!recordingUri || isBusy || !canUpload) return;

        const uploadResult = await uploadAudio(recordingUri, durationSeconds);
        if (!uploadResult.success || !uploadResult.mediaPath) {
            console.error("Failed to upload audio response:", uploadResult.error);
            return;
        }

        await handleAnswerPress("yes", {
            type: "audio",
            media_path: uploadResult.mediaPath,
            duration_seconds: durationSeconds,
        });
        resetRecording();
    };

    const handleDiscardRecording = () => {
        if (isBusy) return;
        resetRecording();
    };

    const AnswerButton = ({ answer }: { answer: SelectableAnswerType }) => {
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
                disabled={isBusy}
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

    const ActionButton = ({
        label,
        icon,
        color = ACCENT,
        onPress,
        disabled = false,
        loading = false,
    }: {
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
        color?: string;
        onPress: () => void;
        disabled?: boolean;
        loading?: boolean;
    }) => {
        const isDisabled = disabled || loading;
        const iconColor = isDisabled ? colors.textTertiary : color;

        return (
            <TouchableOpacity
                style={[styles.actionButton, isDisabled && styles.actionButtonDisabled]}
                onPress={onPress}
                disabled={isDisabled}
                activeOpacity={0.7}
            >
                {loading ? (
                    <ActivityIndicator color={iconColor} size="small" />
                ) : (
                    <Ionicons name={icon} size={20} color={iconColor} />
                )}
                <Text style={[styles.actionButtonText, { color: iconColor }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const ChoiceButton = ({
        label,
        selected,
        onPress,
        disabled = false,
    }: {
        label: string;
        selected: boolean;
        onPress: () => void;
        disabled?: boolean;
    }) => (
        <TouchableOpacity
            style={[styles.choiceButton, selected && styles.choiceButtonSelected]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <Text style={[styles.choiceButtonText, selected && styles.choiceButtonTextSelected]}>
                {label}
            </Text>
            {selected && <Ionicons name="checkmark" size={16} color={ACCENT} />}
        </TouchableOpacity>
    );

    const isSavingYes = isLoading && pendingAnswer === "yes";
    const isSavingNo = isLoading && pendingAnswer === "no";

    const actionContent = (() => {
        if (questionType === "text_answer") {
            return (
                <View style={styles.editorContainer}>
                    <View style={styles.textInputContainer}>
                        <TextInput
                            style={styles.textInput}
                            value={textValue}
                            onChangeText={(value) => setTextValue(value.slice(0, MAX_TEXT_LENGTH))}
                            placeholder="Update your answer..."
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            editable={!isBusy}
                            textAlignVertical="top"
                            maxLength={MAX_TEXT_LENGTH}
                        />
                        <View style={styles.charCountContainer}>
                            <Text style={styles.charCount}>
                                {textValue.length}/{MAX_TEXT_LENGTH}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.actionRow}>
                        <ActionButton
                            label="Set No"
                            icon="close"
                            color={ANSWER_CONFIG.no.color}
                            onPress={handleSetNo}
                            disabled={isBusy || isNoSelected}
                            loading={isSavingNo}
                        />
                        <ActionButton
                            label="Save"
                            icon="checkmark"
                            color={ANSWER_CONFIG.yes.color}
                            onPress={handleTextSave}
                            disabled={isTextSaveDisabled}
                            loading={isSavingYes}
                        />
                    </View>
                </View>
            );
        }

        if (questionType === "who_likely") {
            return (
                <View style={styles.editorContainer}>
                    <View style={styles.choiceRow}>
                        <ChoiceButton
                            label={userLabel}
                            selected={selectedWhoLikely === user?.id}
                            onPress={() => {
                                if (user?.id) {
                                    handleWhoLikelySelect(user.id);
                                }
                            }}
                            disabled={isBusy || !user?.id}
                        />
                        <ChoiceButton
                            label={partnerLabel}
                            selected={selectedWhoLikely === partner?.id}
                            onPress={() => {
                                if (partner?.id) {
                                    handleWhoLikelySelect(partner.id);
                                }
                            }}
                            disabled={isBusy || !partner?.id}
                        />
                    </View>
                    <View style={styles.actionRow}>
                        <ActionButton
                            label="Set No"
                            icon="close"
                            color={ANSWER_CONFIG.no.color}
                            onPress={handleSetNo}
                            disabled={isBusy || isNoSelected}
                            loading={isSavingNo}
                        />
                    </View>
                </View>
            );
        }

        if (questionType === "photo") {
            return (
                <View style={styles.editorContainer}>
                    <View style={styles.actionRow}>
                        <ActionButton
                            label="Camera"
                            icon="camera"
                            onPress={() => handlePhotoPick("camera")}
                            disabled={isBusy || !canUpload}
                            loading={uploading}
                        />
                        <ActionButton
                            label="Library"
                            icon="images"
                            onPress={() => handlePhotoPick("library")}
                            disabled={isBusy || !canUpload}
                            loading={uploading}
                        />
                    </View>
                    <View style={styles.actionRow}>
                        <ActionButton
                            label="Set No"
                            icon="close"
                            color={ANSWER_CONFIG.no.color}
                            onPress={handleSetNo}
                            disabled={isBusy || isNoSelected}
                            loading={isSavingNo}
                        />
                    </View>
                </View>
            );
        }

        if (questionType === "audio") {
            const statusText = audioState === "recording"
                ? `Recording... ${durationSeconds}s`
                : recordingUri
                    ? `Recorded ${durationSeconds}s`
                    : "Tap record to start";

            return (
                <View style={styles.editorContainer}>
                    <Text style={styles.audioStatusText}>{statusText}</Text>
                    <View style={styles.actionRow}>
                        <ActionButton
                            label={audioState === "recording" ? "Stop" : recordingUri ? "Re-record" : "Record"}
                            icon={audioState === "recording" ? "square" : "mic"}
                            onPress={audioState === "recording" ? handleStopRecording : handleStartRecording}
                            disabled={isBusy}
                        />
                        <ActionButton
                            label="Save"
                            icon="checkmark"
                            color={ANSWER_CONFIG.yes.color}
                            onPress={handleAudioSave}
                            disabled={!recordingUri || audioState === "recording" || isBusy || !canUpload}
                            loading={uploading || isSavingYes}
                        />
                    </View>
                    {recordingUri && audioState !== "recording" && (
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={handleDiscardRecording}
                            disabled={isBusy}
                        >
                            <Text style={styles.linkButtonText}>Discard recording</Text>
                        </TouchableOpacity>
                    )}
                    <View style={styles.actionRow}>
                        <ActionButton
                            label="Set No"
                            icon="close"
                            color={ANSWER_CONFIG.no.color}
                            onPress={handleSetNo}
                            disabled={isBusy || isNoSelected}
                            loading={isSavingNo}
                        />
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.answerButtons}>
                <AnswerButton answer="yes" />
                <AnswerButton answer="no" />
            </View>
        );
    })();

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
                                actions={actionContent}
                                onClose={onClose}
                            />
                        </BlurView>
                    ) : (
                        <View style={[styles.sheet, styles.sheetAndroid]}>
                            <SheetContent
                                response={response}
                                actions={actionContent}
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
    actions,
    onClose,
}: {
    response: ResponseWithQuestion;
    actions: ReactNode;
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

            {/* Action content */}
            <View style={styles.actionsContainer}>{actions}</View>

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
    actionsContainer: {
        marginBottom: spacing.lg,
    },
    editorContainer: {
        gap: spacing.md,
    },
    textInputContainer: {
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        padding: spacing.md,
        minHeight: 120,
    },
    textInput: {
        ...typography.body,
        color: colors.text,
        minHeight: 80,
    },
    charCountContainer: {
        alignItems: "flex-end",
        marginTop: spacing.xs,
    },
    charCount: {
        ...typography.caption2,
        color: colors.textTertiary,
    },
    answerButtons: {
        flexDirection: "row",
        gap: spacing.md,
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
    actionRow: {
        flexDirection: "row",
        gap: spacing.md,
        alignItems: "center",
    },
    actionButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        gap: spacing.xs,
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        ...typography.caption1,
        fontWeight: "600",
    },
    choiceRow: {
        flexDirection: "row",
        gap: spacing.md,
    },
    choiceButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        flexDirection: "row",
        gap: spacing.xs,
    },
    choiceButtonSelected: {
        borderColor: `${ACCENT_RGBA}0.6)`,
        backgroundColor: `${ACCENT_RGBA}0.12)`,
    },
    choiceButtonText: {
        ...typography.callout,
        color: colors.textSecondary,
        fontWeight: "600",
    },
    choiceButtonTextSelected: {
        color: ACCENT,
    },
    audioStatusText: {
        ...typography.caption1,
        color: colors.textSecondary,
        textAlign: "center",
    },
    linkButton: {
        alignSelf: "center",
    },
    linkButtonText: {
        ...typography.caption1,
        color: colors.textTertiary,
        textDecorationLine: "underline",
    },
    bottomPadding: {
        height: Platform.OS === "ios" ? 34 : 20,
    },
});
