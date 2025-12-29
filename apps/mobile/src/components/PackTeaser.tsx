import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform,
    Pressable,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { colors, gradients, spacing, radius, typography } from "../theme";

interface PackTeaserProps {
    visible: boolean;
    packId: string;
    packName: string;
    packIcon: string | null;
    onClose: () => void;
    onUnlock: () => void;
}

interface PreviewQuestion {
    id: string;
    text: string;
    intensity: number;
}

const TEASER_QUESTION_COUNT = 3;

export function PackTeaser({
    visible,
    packId,
    packName,
    packIcon,
    onClose,
    onUnlock,
}: PackTeaserProps) {
    const [questions, setQuestions] = useState<PreviewQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const overlayOpacity = useSharedValue(0);
    const contentTranslateY = useSharedValue(300);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    const contentStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: contentTranslateY.value }],
    }));

    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            overlayOpacity.value = withTiming(1, { duration: 250 });
            contentTranslateY.value = withTiming(0, { duration: 300 });
        } else {
            overlayOpacity.value = withTiming(0, { duration: 200 });
            contentTranslateY.value = withTiming(300, { duration: 250 }, () => {
                runOnJS(setModalVisible)(false);
            });
        }
    }, [visible]);

    useEffect(() => {
        if (visible && packId) {
            fetchQuestions();
        }
    }, [visible, packId]);

    const fetchQuestions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc("get_pack_teaser_questions", {
                target_pack_id: packId,
            });

            if (error) {
                console.error("Error fetching teaser questions:", error);
                return;
            }

            // Take only the first 3 questions for the teaser
            const previewQuestions = (data || [])
                .slice(0, TEASER_QUESTION_COUNT)
                .map((q: any) => ({
                    id: q.id,
                    text: q.text,
                    intensity: q.intensity,
                }));

            setQuestions(previewQuestions);
        } catch (error) {
            console.error("Failed to fetch teaser questions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={modalVisible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <Animated.View style={[styles.overlay, overlayStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>
                <Animated.View style={[styles.content, contentStyle]}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Close Button */}
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.iconContainer}>
                                <Text style={styles.packEmoji}>{packIcon || "📦"}</Text>
                            </View>
                            <Text style={styles.title}>{packName}</Text>
                            <Text style={styles.subtitle}>
                                Preview a few questions from this pack
                            </Text>
                        </View>

                        {/* Questions Preview */}
                        <View style={styles.questionsContainer}>
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator color={colors.primary} size="large" />
                                    <Text style={styles.loadingText}>
                                        Loading preview...
                                    </Text>
                                </View>
                            ) : questions.length > 0 ? (
                                questions.map((question, index) => (
                                    <View key={question.id} style={styles.questionCard}>
                                        <View style={styles.questionHeader}>
                                            <View style={styles.intensityContainer}>
                                                {[...Array(question.intensity)].map((_, i) => (
                                                    <Ionicons
                                                        key={i}
                                                        name="flame"
                                                        size={12}
                                                        color={colors.primary}
                                                    />
                                                ))}
                                            </View>
                                            <Text style={styles.questionNumber}>
                                                {index + 1} of {questions.length}
                                            </Text>
                                        </View>
                                        <Text style={styles.questionText}>{question.text}</Text>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>
                                        No preview available
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* More questions hint */}
                        {questions.length > 0 && (
                            <View style={styles.moreHint}>
                                <Ionicons
                                    name="lock-closed"
                                    size={16}
                                    color={colors.textTertiary}
                                />
                                <Text style={styles.moreHintText}>
                                    + many more questions to unlock
                                </Text>
                            </View>
                        )}

                        {/* Unlock Button */}
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.unlockButton}
                                onPress={onUnlock}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.unlockButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Ionicons
                                        name="star"
                                        size={20}
                                        color={colors.text}
                                        style={{ marginRight: spacing.sm }}
                                    />
                                    <Text style={styles.unlockButtonText}>
                                        Unlock with Pro
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "flex-end",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
    },
    content: {
        backgroundColor: colors.backgroundLight,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        maxHeight: "85%",
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: colors.glass.border,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: Platform.OS === "ios" ? 40 : spacing.lg,
    },
    closeButton: {
        position: "absolute",
        top: spacing.md,
        right: spacing.md,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    header: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    packEmoji: {
        fontSize: 36,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
    questionsContainer: {
        marginBottom: spacing.lg,
        gap: spacing.md,
    },
    loadingContainer: {
        alignItems: "center",
        padding: spacing.xl,
    },
    loadingText: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    questionCard: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.md,
    },
    questionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    intensityContainer: {
        flexDirection: "row",
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.full,
        gap: 1,
    },
    questionNumber: {
        ...typography.caption2,
        color: colors.textTertiary,
    },
    questionText: {
        ...typography.body,
        color: colors.text,
        lineHeight: 22,
    },
    emptyContainer: {
        alignItems: "center",
        padding: spacing.xl,
    },
    emptyText: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    moreHint: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
        gap: spacing.xs,
    },
    moreHintText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    actions: {
        marginBottom: spacing.md,
    },
    unlockButton: {
        borderRadius: radius.lg,
        overflow: "hidden",
    },
    unlockButtonGradient: {
        flexDirection: "row",
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
    unlockButtonText: {
        ...typography.headline,
        color: colors.text,
    },
});

export default PackTeaser;
