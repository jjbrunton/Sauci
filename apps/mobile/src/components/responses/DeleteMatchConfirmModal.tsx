import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { colors, spacing, typography, radius } from "../../theme";

interface DeleteMatchConfirmModalProps {
    visible: boolean;
    messageCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export function DeleteMatchConfirmModal({
    visible,
    messageCount,
    onConfirm,
    onCancel,
}: DeleteMatchConfirmModalProps) {
    const messageText =
        messageCount === 0
            ? "This will delete your match."
            : messageCount === 1
              ? "This will delete your match and 1 message."
              : `This will delete your match and ${messageCount} messages.`;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onCancel}
            statusBarTranslucent
        >
            <Animated.View
                style={styles.overlay}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
            >
                <TouchableWithoutFeedback onPress={onCancel}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={styles.modalContainer}
                    entering={ZoomIn.springify().damping(20)}
                    exiting={ZoomOut.duration(150)}
                >
                    {Platform.OS === "ios" ? (
                        <BlurView intensity={80} tint="dark" style={styles.modal}>
                            <ModalContent
                                messageText={messageText}
                                onConfirm={onConfirm}
                                onCancel={onCancel}
                            />
                        </BlurView>
                    ) : (
                        <View style={[styles.modal, styles.modalAndroid]}>
                            <ModalContent
                                messageText={messageText}
                                onConfirm={onConfirm}
                                onCancel={onCancel}
                            />
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

function ModalContent({
    messageText,
    onConfirm,
    onCancel,
}: {
    messageText: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <>
            {/* Warning icon */}
            <View style={styles.iconContainer}>
                <Ionicons name="warning" size={32} color={colors.error} />
            </View>

            {/* Title */}
            <Text style={styles.title}>Delete Match?</Text>

            {/* Message */}
            <Text style={styles.message}>
                Changing your answer to "No" will remove this match permanently.{"\n\n"}
                {messageText}
            </Text>

            {/* Buttons */}
            <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
                    <Text style={styles.cancelButtonText}>Keep Match</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} onPress={onConfirm} activeOpacity={0.7}>
                    <LinearGradient
                        colors={[colors.error, "#c0392b"]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.deleteButtonText}>Delete Match</Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
    },
    modalContainer: {
        width: "100%",
        maxWidth: 340,
    },
    modal: {
        borderRadius: radius.xl,
        overflow: "hidden",
        padding: spacing.xl,
        alignItems: "center",
    },
    modalAndroid: {
        backgroundColor: colors.backgroundLight,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(231, 76, 60, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(231, 76, 60, 0.25)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.title2,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    message: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    buttons: {
        width: "100%",
        gap: spacing.sm,
    },
    cancelButton: {
        width: "100%",
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
        alignItems: "center",
    },
    cancelButtonText: {
        ...typography.callout,
        color: colors.text,
        fontWeight: "600",
    },
    deleteButton: {
        width: "100%",
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    deleteButtonText: {
        ...typography.callout,
        color: colors.text,
        fontWeight: "700",
    },
});
