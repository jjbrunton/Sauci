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
import { getPackIconName } from "../lib/packIcons";
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
                    {/* Premium gradient background */}
                    <LinearGradient
                        colors={['rgba(22, 33, 62, 0.98)', 'rgba(13, 13, 26, 1)']}
                        style={StyleSheet.absoluteFill}
                    />
                    {/* Top silk highlight */}
                    <LinearGradient
                        colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
                        style={styles.silkHighlight}
                    />
                    {/* Premium border accent */}
                    <View style={styles.premiumBorderAccent} />

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
                            {/* Premium label */}
                            <Text style={styles.label}>PREMIUM COLLECTION</Text>

                            {/* Icon with glow */}
                            <View style={styles.iconWrapper}>
                                <View style={styles.iconContainer}>
                                    <LinearGradient
                                        colors={['rgba(212, 175, 55, 0.15)', 'rgba(184, 134, 11, 0.1)']}
                                        style={StyleSheet.absoluteFill}
                                    />
                                    <Ionicons
                                        name={getPackIconName(packIcon)}
                                        size={36}
                                        color={colors.premium.gold}
                                    />
                                </View>
                                {/* Crown badge */}
                                <View style={styles.crownBadge}>
                                    <Ionicons name="star" size={12} color={colors.premium.gold} />
                                </View>
                            </View>

                            <Text style={styles.title}>{packName}</Text>

                            {/* Decorative separator */}
                            <View style={styles.separator}>
                                <View style={styles.separatorLine} />
                                <View style={styles.separatorDiamond} />
                                <View style={styles.separatorLine} />
                            </View>

                            <Text style={styles.subtitle}>
                                Preview a few questions from this exclusive pack
                            </Text>
                        </View>

                        {/* Questions Preview */}
                        <View style={styles.questionsContainer}>
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator color={colors.premium.gold} size="large" />
                                    <Text style={styles.loadingText}>
                                        Loading preview...
                                    </Text>
                                </View>
                            ) : questions.length > 0 ? (
                                questions.map((question, index) => (
                                    <View key={question.id} style={styles.questionCard}>
                                        <View style={styles.questionHeader}>
                                            <View style={styles.intensityContainer}>
                                                {[...Array(5)].map((_, i) => (
                                                    <Ionicons
                                                        key={i}
                                                        name={i < question.intensity ? "flame" : "flame-outline"}
                                                        size={12}
                                                        color={i < question.intensity ? colors.premium.gold : 'rgba(255, 255, 255, 0.2)'}
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
                                    name="diamond"
                                    size={16}
                                    color={colors.premium.gold}
                                />
                                <Text style={styles.moreHintText}>
                                    + many more exclusive questions to unlock
                                </Text>
                            </View>
                        )}

                        {/* Unlock Button */}
                        <View style={styles.actions}>
                            <Pressable
                                style={styles.unlockButton}
                                onPress={onUnlock}
                            >
                                <LinearGradient
                                    colors={[colors.premium.gold, colors.premium.goldDark]}
                                    style={styles.unlockButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Ionicons
                                        name="diamond"
                                        size={18}
                                        color={colors.background}
                                        style={{ marginRight: spacing.sm }}
                                    />
                                    <Text style={styles.unlockButtonText}>
                                        Unlock with Pro
                                    </Text>
                                </LinearGradient>
                            </Pressable>
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
        backgroundColor: "rgba(0, 0, 0, 0.85)",
    },
    content: {
        backgroundColor: colors.background,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        maxHeight: "85%",
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        overflow: 'hidden',
    },
    silkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 150,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
    },
    premiumBorderAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: colors.premium.gold,
        opacity: 0.4,
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
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    label: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 3,
        color: colors.premium.gold,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    iconWrapper: {
        position: 'relative',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: colors.premium.gold,
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 12,
    },
    crownBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.premium.gold,
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        marginBottom: spacing.xs,
        textShadowColor: 'rgba(212, 175, 55, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.md,
        width: 140,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(212, 175, 55, 0.3)',
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: colors.premium.gold,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.md,
        opacity: 0.8,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 24,
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
        backgroundColor: 'rgba(22, 33, 62, 0.4)',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
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
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.full,
        gap: 2,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    questionNumber: {
        ...typography.caption2,
        color: colors.premium.champagne,
        opacity: 0.7,
    },
    questionText: {
        ...typography.body,
        color: colors.text,
        lineHeight: 24,
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
        gap: spacing.sm,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    moreHintText: {
        ...typography.caption1,
        color: colors.premium.champagne,
        fontWeight: '500',
    },
    actions: {
        marginBottom: spacing.md,
    },
    unlockButton: {
        borderRadius: radius.lg,
        overflow: "hidden",
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    unlockButtonGradient: {
        flexDirection: "row",
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
    unlockButtonText: {
        ...typography.headline,
        color: colors.background,
        fontWeight: '700',
    },
});

export default PackTeaser;
