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
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { colors, spacing, typography, radius } from "../../../theme";
import { REPORT_REASONS, type ReportReason } from "../types";

interface ReportMessageSheetProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (reason: ReportReason) => Promise<void>;
}

export function ReportMessageSheet({ visible, onClose, onSubmit }: ReportMessageSheetProps) {
    const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setSelectedReason(null);
            setIsLoading(false);
        }
    }, [visible]);

    const handleSubmit = async () => {
        if (!selectedReason || isLoading) return;

        setIsLoading(true);
        await onSubmit(selectedReason);
        setIsLoading(false);
    };

    const ReasonButton = ({ reason }: { reason: typeof REPORT_REASONS[number] }) => {
        const isSelected = selectedReason === reason.value;

        return (
            <TouchableOpacity
                style={[
                    styles.reasonButton,
                    isSelected && styles.reasonButtonSelected,
                ]}
                onPress={() => setSelectedReason(reason.value)}
                disabled={isLoading}
                activeOpacity={0.7}
            >
                <View style={styles.reasonContent}>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                        {reason.label}
                    </Text>
                </View>
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
                                ReasonButton={ReasonButton}
                                selectedReason={selectedReason}
                                isLoading={isLoading}
                                onClose={onClose}
                                onSubmit={handleSubmit}
                            />
                        </BlurView>
                    ) : (
                        <View style={[styles.sheet, styles.sheetAndroid]}>
                            <SheetContent
                                ReasonButton={ReasonButton}
                                selectedReason={selectedReason}
                                isLoading={isLoading}
                                onClose={onClose}
                                onSubmit={handleSubmit}
                            />
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

// Sheet content extracted for reuse between iOS blur and Android solid background
function SheetContent({
    ReasonButton,
    selectedReason,
    isLoading,
    onClose,
    onSubmit,
}: {
    ReasonButton: React.FC<{ reason: typeof REPORT_REASONS[number] }>;
    selectedReason: ReportReason | null;
    isLoading: boolean;
    onClose: () => void;
    onSubmit: () => void;
}) {
    return (
        <>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Report Message</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={styles.description}>
                Why are you reporting this message?
            </Text>

            {/* Reason buttons */}
            <View style={styles.reasonButtons}>
                {REPORT_REASONS.map((reason) => (
                    <ReasonButton key={reason.value} reason={reason} />
                ))}
            </View>

            {/* Submit button */}
            <TouchableOpacity
                style={[
                    styles.submitButton,
                    !selectedReason && styles.submitButtonDisabled,
                ]}
                onPress={onSubmit}
                disabled={!selectedReason || isLoading}
                activeOpacity={0.7}
            >
                {isLoading ? (
                    <ActivityIndicator color={colors.text} size="small" />
                ) : (
                    <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
            </TouchableOpacity>

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
        marginBottom: spacing.md,
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
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.lg,
    },
    reasonButtons: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    reasonButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    reasonButtonSelected: {
        backgroundColor: "rgba(231, 76, 60, 0.1)",
        borderColor: "rgba(231, 76, 60, 0.3)",
    },
    reasonContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: colors.textTertiary,
        justifyContent: "center",
        alignItems: "center",
    },
    radioOuterSelected: {
        borderColor: colors.error,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.error,
    },
    reasonText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    reasonTextSelected: {
        color: colors.text,
        fontWeight: "600",
    },
    submitButton: {
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.error,
        alignItems: "center",
        justifyContent: "center",
    },
    submitButtonDisabled: {
        backgroundColor: "rgba(231, 76, 60, 0.3)",
    },
    submitButtonText: {
        ...typography.callout,
        color: colors.text,
        fontWeight: "600",
    },
    bottomPadding: {
        height: Platform.OS === "ios" ? 34 : 20,
    },
});
