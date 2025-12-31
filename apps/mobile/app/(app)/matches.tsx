import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { useMatchStore, useAuthStore } from "../../src/store";
import { useEffect, useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { colors, gradients, spacing, typography, radius, shadows } from "../../src/theme";
import MatchesTutorial from "../../src/components/MatchesTutorial";
import { hasSeenMatchesTutorial, markMatchesTutorialSeen } from "../../src/lib/matchesTutorialSeen";

const MAX_CONTENT_WIDTH = 500;

export default function MatchesScreen() {
    const { matches, fetchMatches, markAllAsSeen } = useMatchStore();
    const { user } = useAuthStore();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;
    const [showTutorial, setShowTutorial] = useState(false);

    // Check if tutorial should be shown when screen is focused or matches change
    useFocusEffect(
        useCallback(() => {
            const checkTutorial = async () => {
                if (matches.length > 0) {
                    const seen = await hasSeenMatchesTutorial();
                    if (!seen) {
                        setShowTutorial(true);
                    }
                }
            };
            checkTutorial();
        }, [matches.length])
    );

    const handleTutorialComplete = async () => {
        await markMatchesTutorialSeen();
        setShowTutorial(false);
    };

    useFocusEffect(
        useCallback(() => {
            fetchMatches();
        }, [])
    );

    useEffect(() => {
        if (matches.length > 0) {
            markAllAsSeen();
        }
    }, [matches.length]);

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const userResponse = item.responses?.find((r: any) => r.user_id === user?.id);
        const partnerResponse = item.responses?.find((r: any) => r.user_id !== user?.id);

        let userText = item.question.text;
        let partnerText = item.question.partner_text;

        if (item.question.partner_text && userResponse && partnerResponse) {
            const userTime = new Date(userResponse.created_at).getTime();
            const partnerTime = new Date(partnerResponse.created_at).getTime();

            if (userTime > partnerTime) {
                userText = item.question.partner_text;
                partnerText = item.question.text;
            }
        }

        const isYesYes = item.match_type === "yes_yes";

        return (
            <Animated.View entering={FadeInRight.delay(index * 50).duration(300)}>
                <TouchableOpacity
                    onPress={() => router.push(`/chat/${item.id}`)}
                    activeOpacity={0.8}
                >
                    <GlassCard style={styles.matchCard}>
                        <View style={styles.matchRow}>
                            <LinearGradient
                                colors={isYesYes ? gradients.primary as [string, string] : [colors.glass.background, colors.glass.background]}
                                style={styles.iconContainer}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons
                                    name={isYesYes ? "heart" : "heart-half"}
                                    size={22}
                                    color={isYesYes ? colors.text : colors.primary}
                                />
                            </LinearGradient>
                            <View style={styles.content}>
                                <Text style={styles.questionText} numberOfLines={2}>
                                    {userText}
                                </Text>
                                {item.question.partner_text && (
                                    <Text style={styles.partnerText} numberOfLines={1}>
                                        Partner: {partnerText}
                                    </Text>
                                )}
                                <View style={styles.metaRow}>
                                    <View style={[styles.tag, isYesYes && styles.tagHighlight]}>
                                        <Text style={[styles.tagText, isYesYes && styles.tagTextHighlight]}>
                                            {isYesYes ? "YES + YES" : "YES + MAYBE"}
                                        </Text>
                                    </View>
                                    <Text style={styles.date}>
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.rightSection}>
                                {item.unreadCount > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Ionicons name="chatbubble" size={12} color={colors.text} />
                                    </View>
                                )}
                                <View style={styles.chevronContainer}>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                </View>
                            </View>
                        </View>
                    </GlassCard>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    if (!user) {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            <View style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(400)}
                    style={[styles.header, isWideScreen && styles.headerWide]}
                >
                    <View style={styles.headerTop}>
                        <Text style={styles.title}>Matches</Text>
                        <View style={styles.countBadge}>
                            <Ionicons name="heart" size={14} color={colors.primary} />
                            <Text style={styles.countText}>{matches.length}</Text>
                        </View>
                    </View>
                    <Text style={styles.subtitle}>
                        Discover what you both enjoy together
                    </Text>
                </Animated.View>

                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.list, isWideScreen && styles.listWide]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={fetchMatches}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <Animated.View
                            entering={FadeInDown.delay(200).duration(400)}
                            style={styles.emptyContainer}
                        >
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.emptyIconGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.emptyIconInner}>
                                    <Ionicons name="heart-outline" size={40} color={colors.primary} />
                                </View>
                            </LinearGradient>
                            <Text style={styles.emptyTitle}>No matches yet</Text>
                            <Text style={styles.emptyText}>
                                Keep swiping to find things you both enjoy!
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyButton}
                                onPress={() => router.push("/(app)/swipe")}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.emptyButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="flame" size={18} color={colors.text} />
                                    <Text style={styles.emptyButtonText}>Start Swiping</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    }
                />
            </View>

            {/* Matches Tutorial Overlay */}
            {showTutorial && (
                <MatchesTutorial onComplete={handleTutorialComplete} />
            )}
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    headerWide: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        ...typography.title1,
        color: colors.text,
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        gap: spacing.xs,
    },
    countText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: '600',
    },
    subtitle: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    list: {
        padding: spacing.lg,
        paddingTop: 0,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    listWide: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
    },
    matchCard: {
        marginBottom: spacing.sm,
    },
    matchRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    content: {
        flex: 1,
    },
    questionText: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
        marginBottom: spacing.xs,
        lineHeight: 22,
    },
    partnerText: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontStyle: "italic",
        marginBottom: spacing.sm,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    tag: {
        backgroundColor: colors.glass.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
    },
    tagHighlight: {
        backgroundColor: colors.primaryLight,
    },
    tagText: {
        ...typography.caption2,
        color: colors.textSecondary,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    tagTextHighlight: {
        color: colors.primary,
    },
    date: {
        ...typography.caption2,
        color: colors.textTertiary,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginLeft: spacing.sm,
    },
    unreadBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.glass.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: "center",
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
    },
    emptyIconGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
        ...shadows.lg,
    },
    emptyIconInner: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        ...typography.title2,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xl,
    },
    emptyButton: {
        borderRadius: radius.full,
        overflow: 'hidden',
        ...shadows.md,
    },
    emptyButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    emptyButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: '600',
    },
});
