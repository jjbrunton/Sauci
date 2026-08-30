import { useEffect, useRef, useState } from "react";
import {
    Linking,
    Modal,
    Platform,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { colors, spacing, typography, blur } from "../../../theme";
import { Events } from "../../../lib/analytics";
import { QuizResultsShareCard } from "./QuizResultsShareCard";

const MAX_CARD_WIDTH = 340;

interface QuizShareModalProps {
    visible: boolean;
    onClose: () => void;
    scorePercent: number;
}

export function QuizShareModal({ visible, onClose, scorePercent }: QuizShareModalProps) {
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = Math.min(screenWidth - 64, MAX_CARD_WIDTH);
    const shareViewRef = useRef<ViewShot>(null);
    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const shareMessage = `We matched on ${scorePercent}% on our couple quiz! Discover more on sauci.app`;

    useEffect(() => {
        if (visible && shareViewRef.current) {
            setIsCapturing(true);
            const timer = setTimeout(async () => {
                try {
                    const uri = await shareViewRef.current?.capture?.();
                    if (uri) setCapturedUri(uri);
                } catch (error) {
                    console.error("Error capturing quiz share image:", error);
                } finally {
                    setIsCapturing(false);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible) setCapturedUri(null);
    }, [visible]);

    const handleInstagramShare = async () => {
        if (!capturedUri) return;

        try {
            const instagramUrl = "instagram://app";
            const canOpenInstagram = await Linking.canOpenURL(instagramUrl);

            if (canOpenInstagram && Platform.OS === "ios") {
                await FileSystem.readAsStringAsync(capturedUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const instagramStoriesUrl = "instagram-stories://share?source_application=com.sauci.app";
                await Linking.openURL(instagramStoriesUrl);
                Events.quizShared();
            } else {
                await handleMoreShare();
            }
        } catch (error) {
            console.error("Instagram share error:", error);
            await handleMoreShare();
        }
    };

    const handleMessagesShare = async () => {
        if (!capturedUri) {
            await Share.share({ message: shareMessage });
            Events.quizShared();
            return;
        }

        try {
            if (Platform.OS === "ios") {
                await Sharing.shareAsync(capturedUri, { mimeType: "image/png", UTI: "public.png" });
                Events.quizShared();
            } else {
                await handleMoreShare();
            }
        } catch (error) {
            console.error("Messages share error:", error);
            await Share.share({ message: shareMessage });
            Events.quizShared();
        }
    };

    const handleMoreShare = async () => {
        if (!capturedUri) {
            await Share.share({ message: shareMessage });
            Events.quizShared();
            return;
        }

        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(capturedUri, { mimeType: "image/png", dialogTitle: "Share your quiz score" });
            } else {
                await Share.share({ message: shareMessage });
            }
            Events.quizShared();
        } catch (error) {
            console.error("Share error:", error);
        }
    };

    const useBlur = Platform.OS === "ios";

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={StyleSheet.absoluteFill}
                >
                    {useBlur ? (
                        <BlurView intensity={blur.heavy} tint="dark" style={StyleSheet.absoluteFill} />
                    ) : (
                        <View style={styles.backdropFallback} />
                    )}
                </Animated.View>

                <Animated.View
                    entering={SlideInDown.springify().damping(20)}
                    exiting={SlideOutDown.duration(200)}
                    style={[styles.content, { paddingTop: insets.top }]}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            testID="quiz-share-close"
                        >
                            <Ionicons name="close" size={28} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Share your score</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <View style={styles.previewContainer}>
                        <ViewShot ref={shareViewRef} options={{ format: "png", quality: 1, result: "tmpfile" }}>
                            <QuizResultsShareCard scorePercent={scorePercent} cardWidth={cardWidth} />
                        </ViewShot>
                    </View>

                    <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
                        <ShareActionButton
                            icon="logo-instagram"
                            label="Instagram"
                            onPress={handleInstagramShare}
                            disabled={isCapturing}
                        />
                        <ShareActionButton
                            icon="chatbubble-ellipses"
                            label="Messages"
                            onPress={handleMessagesShare}
                            disabled={isCapturing}
                        />
                        <ShareActionButton
                            icon="share-outline"
                            label="More"
                            onPress={handleMoreShare}
                            disabled={isCapturing}
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

function ShareActionButton({
    icon,
    label,
    onPress,
    disabled,
}: {
    icon: string;
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    return (
        <TouchableOpacity
            style={styles.actionButton}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            testID={`quiz-share-${icon}`}
        >
            <View style={styles.actionIconContainer}>
                <Ionicons name={icon as any} size={28} color={colors.text} />
            </View>
            <Text style={styles.actionLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    backdropFallback: {
        flex: 1,
        backgroundColor: "rgba(14, 14, 17, 0.95)",
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    closeButton: {
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        ...typography.headline,
        color: colors.text,
        fontWeight: "600",
    },
    headerSpacer: {
        width: 44,
    },
    previewContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
    },
    actionsContainer: {
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.xl,
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    actionButton: {
        alignItems: "center",
        gap: spacing.sm,
    },
    actionIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionLabel: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: "500",
    },
});
