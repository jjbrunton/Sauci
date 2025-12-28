import { useState, useEffect } from "react";
import { View, StyleSheet, Text, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { supabase } from "../../src/lib/supabase";
import { usePacksStore } from "../../src/store";
import SwipeCard from "../../src/components/SwipeCard";
import { GradientBackground, GlassCard, GlassButton } from "../../src/components/ui";
import { colors, spacing, typography, radius, shadows } from "../../src/theme";

export default function SwipeScreen() {
    const { packId } = useLocalSearchParams();
    const [questions, setQuestions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const { enabledPackIds, fetchPacks } = usePacksStore();

    useEffect(() => {
        fetchPacks().then(() => fetchQuestions());
    }, [packId]);

    const fetchQuestions = async () => {
        try {
            const { data, error } = await supabase.rpc("get_recommended_questions", {
                target_pack_id: packId || null
            });

            if (error) {
                console.error("Error fetching recommended questions:", error);
                throw error;
            }

            const sorted = (data || []).sort((a: any, b: any) => {
                let scoreA = Math.random();
                let scoreB = Math.random();

                if (a.partner_answered && a.is_two_part) scoreA += 1.5;
                else if (a.partner_answered) scoreA += 0.7;
                else if (a.is_two_part) scoreA += 0.4;

                if (b.partner_answered && b.is_two_part) scoreB += 1.5;
                else if (b.partner_answered) scoreB += 0.7;
                else if (b.is_two_part) scoreB += 0.4;

                return scoreB - scoreA;
            });

            setQuestions(sorted);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwipe = async (direction: "left" | "right" | "up") => {
        const question = questions[currentIndex];
        const answer = direction === "right" ? "yes" : direction === "left" ? "no" : "maybe";

        setCurrentIndex(prev => prev + 1);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            console.log("DEBUG - Session exists:", !!session);

            await supabase.functions.invoke("submit-response", {
                body: {
                    question_id: question.id,
                    answer,
                },
            });
        } catch (error) {
            console.error("Failed to submit response", error);
        }
    };

    if (isLoading) {
        return (
            <GradientBackground>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    // Show "no packs enabled" message when not viewing a specific pack and no packs are enabled
    if (!packId && enabledPackIds.length === 0) {
        return (
            <GradientBackground showAccent>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.emptyContent}
                    >
                        <View style={styles.noPacksIconContainer}>
                            <Ionicons name="layers-outline" size={64} color={colors.textTertiary} />
                        </View>
                        <Text style={styles.emptyTitle}>No packs enabled</Text>
                        <Text style={styles.emptySubtitle}>
                            Enable at least one question pack to start playing.
                        </Text>
                        <GlassButton
                            onPress={() => router.push("/packs")}
                            style={{ marginTop: spacing.lg }}
                        >
                            Choose Packs
                        </GlassButton>
                    </Animated.View>
                </View>
            </GradientBackground>
        );
    }

    if (currentIndex >= questions.length) {
        return (
            <GradientBackground showAccent>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.emptyContent}
                    >
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>All caught up!</Text>
                        <Text style={styles.emptySubtitle}>
                            Check back later for more questions or try a different pack.
                        </Text>
                        <GlassButton
                            variant="secondary"
                            onPress={fetchQuestions}
                            style={{ marginTop: spacing.lg }}
                        >
                            Refresh Questions
                        </GlassButton>
                    </Animated.View>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Header */}
                <Animated.View
                    entering={FadeIn.duration(400)}
                    style={styles.header}
                >
                    <View style={styles.progressContainer}>
                        <Text style={styles.progressText}>
                            {currentIndex + 1} of {questions.length}
                        </Text>
                        <View style={styles.progressBar}>
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    { width: `${((currentIndex + 1) / questions.length) * 100}%` }
                                ]}
                            />
                        </View>
                    </View>
                </Animated.View>

                {/* Card Stack */}
                <View style={styles.cardContainer}>
                    {/* Background card (next) */}
                    {questions[currentIndex + 1] && (
                        <View style={styles.backgroundCard} />
                    )}

                    {/* Active card */}
                    <SwipeCard
                        key={questions[currentIndex].id}
                        question={questions[currentIndex]}
                        onSwipe={handleSwipe}
                    />
                </View>

                {/* Hint */}
                <Animated.View
                    entering={FadeIn.delay(500).duration(400)}
                    style={styles.hintContainer}
                >
                    <Text style={styles.hintText}>Swipe or tap to answer</Text>
                </Animated.View>

                {/* Bottom spacing for tab bar */}
                <View style={styles.bottomSpacer} />
            </View>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    progressContainer: {
        alignItems: "center",
    },
    progressText: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    progressBar: {
        width: 120,
        height: 4,
        backgroundColor: colors.glass.background,
        borderRadius: 2,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
    cardContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    backgroundCard: {
        position: "absolute",
        width: "85%",
        height: 480,
        backgroundColor: colors.glass.backgroundLight,
        borderRadius: radius.xxl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        transform: [{ scale: 0.95 }, { translateY: 12 }],
        opacity: 0.5,
        ...shadows.md,
    },
    hintContainer: {
        alignItems: "center",
        paddingBottom: spacing.md,
    },
    hintText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    emptyContent: {
        alignItems: "center",
        paddingHorizontal: spacing.xl,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    noPacksIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        ...typography.title2,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
    bottomSpacer: {
        height: Platform.OS === 'ios' ? 100 : 80,
    },
});
