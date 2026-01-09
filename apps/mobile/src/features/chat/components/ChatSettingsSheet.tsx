import { useState } from "react";
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

interface ChatSettingsSheetProps {
    visible: boolean;
    onClose: () => void;
    isArchived: boolean;
    onArchive: () => Promise<void>;
    onUnarchive: () => Promise<void>;
}

const ACCENT = colors.premium.gold;

export function ChatSettingsSheet({
    visible,
    onClose,
    isArchived,
    onArchive,
    onUnarchive,
}: ChatSettingsSheetProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleArchiveToggle = async () => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            if (isArchived) {
                await onUnarchive();
            } else {
                await onArchive();
            }
            onClose();
        } finally {
            setIsLoading(false);
        }
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
                                isArchived={isArchived}
                                isLoading={isLoading}
                                onClose={onClose}
                                onArchiveToggle={handleArchiveToggle}
                            />
                        </BlurView>
                    ) : (
                        <View style={[styles.sheet, styles.sheetAndroid]}>
                            <SheetContent
                                isArchived={isArchived}
                                isLoading={isLoading}
                                onClose={onClose}
                                onArchiveToggle={handleArchiveToggle}
                            />
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

function SheetContent({
    isArchived,
    isLoading,
    onClose,
    onArchiveToggle,
}: {
    isArchived: boolean;
    isLoading: boolean;
    onClose: () => void;
    onArchiveToggle: () => void;
}) {
    return (
        <>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chat Settings</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Archive option */}
            <TouchableOpacity
                style={styles.optionButton}
                onPress={onArchiveToggle}
                disabled={isLoading}
                activeOpacity={0.7}
            >
                <View style={styles.optionContent}>
                    <View style={styles.optionIconContainer}>
                        <Ionicons
                            name={isArchived ? "arrow-undo" : "archive"}
                            size={22}
                            color={ACCENT}
                        />
                    </View>
                    <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>
                            {isArchived ? "Unarchive Chat" : "Archive Chat"}
                        </Text>
                        <Text style={styles.optionDescription}>
                            {isArchived
                                ? "Move this chat back to your main list"
                                : "Hide this chat from your main list"}
                        </Text>
                    </View>
                    {isLoading && (
                        <ActivityIndicator size="small" color={ACCENT} style={styles.optionLoader} />
                    )}
                </View>
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
    optionButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        marginBottom: spacing.md,
    },
    optionContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    optionIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `rgba(212, 175, 55, 0.1)`,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        ...typography.callout,
        color: colors.text,
        fontWeight: "600",
        marginBottom: 2,
    },
    optionDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
    },
    optionLoader: {
        marginLeft: spacing.sm,
    },
    bottomPadding: {
        height: Platform.OS === "ios" ? 34 : 20,
    },
});
