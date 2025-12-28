import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useMatchStore, useAuthStore } from "../../src/store";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { colors, spacing, typography, radius } from "../../src/theme";

export default function MatchesScreen() {
    const { matches, fetchMatches, markAllAsSeen } = useMatchStore();
    const { user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        fetchMatches();
    }, []);

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
                    activeOpacity={0.7}
                >
                    <GlassCard style={styles.matchCard}>
                        <View style={styles.iconContainer}>
                            <Ionicons
                                name={isYesYes ? "heart" : "heart-half"}
                                size={24}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.content}>
                            <Text style={styles.questionText} numberOfLines={2}>
                                {userText}
                            </Text>
                            {item.question.partner_text && (
                                <Text style={styles.partnerText} numberOfLines={1}>
                                    Partner: {partnerText}
                                </Text>
                            )}
                            <View style={styles.metaContainer}>
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
                        <View style={styles.chevronContainer}>
                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
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
                    style={styles.header}
                >
                    <Text style={styles.title}>Your Matches</Text>
                    <Text style={styles.subtitle}>
                        {matches.length} {matches.length === 1 ? 'match' : 'matches'} found
                    </Text>
                </Animated.View>

                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
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
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="heart-outline" size={48} color={colors.textTertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>No matches yet</Text>
                            <Text style={styles.emptyText}>
                                Keep swiping to find things you both enjoy!
                            </Text>
                        </Animated.View>
                    }
                />
            </View>
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
        paddingBottom: spacing.md,
    },
    title: {
        ...typography.title1,
        color: colors.text,
    },
    subtitle: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    list: {
        padding: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    matchCard: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primaryLight,
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
    },
    partnerText: {
        ...typography.subhead,
        color: colors.textSecondary,
        fontStyle: "italic",
        marginBottom: spacing.sm,
    },
    metaContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    tag: {
        backgroundColor: colors.glass.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.xs,
    },
    tagHighlight: {
        backgroundColor: colors.primaryLight,
    },
    tagText: {
        ...typography.caption2,
        color: colors.textSecondary,
        fontWeight: "600",
    },
    tagTextHighlight: {
        color: colors.primary,
    },
    date: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    chevronContainer: {
        marginLeft: spacing.sm,
    },
    emptyContainer: {
        alignItems: "center",
        paddingVertical: spacing.xxl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
});
