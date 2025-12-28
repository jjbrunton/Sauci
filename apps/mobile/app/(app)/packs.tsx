import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, RefreshControl, Platform } from "react-native";
import { usePacksStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { colors, spacing, typography, radius } from "../../src/theme";

export default function PacksScreen() {
    const { packs, enabledPackIds, togglePack, isLoading, fetchPacks } = usePacksStore();

    useEffect(() => {
        fetchPacks();
    }, []);

    const enabledCount = packs.filter(p => enabledPackIds.includes(p.id)).length;

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const isEnabled = enabledPackIds.includes(item.id);

        return (
            <Animated.View entering={FadeInRight.delay(index * 50).duration(300)}>
                <GlassCard style={styles.card}>
                    <TouchableOpacity
                        style={styles.cardContent}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/pack/${item.id}`)}
                    >
                        <View style={[styles.iconContainer, isEnabled && styles.iconContainerActive]}>
                            <Text style={styles.emoji}>{item.icon || "📦"}</Text>
                        </View>
                        <View style={styles.content}>
                            <View style={styles.headerRow}>
                                <Text style={styles.name}>{item.name}</Text>
                                {item.is_premium && (
                                    <View style={styles.badge}>
                                        <Ionicons name="star" size={10} color={colors.text} />
                                        <Text style={styles.badgeText}>PRO</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.description} numberOfLines={2}>
                                {item.description}
                            </Text>
                            {item.question_count && (
                                <Text style={styles.questionCount}>
                                    {item.question_count} questions
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                    <View style={styles.switchContainer}>
                        <Switch
                            value={isEnabled}
                            onValueChange={() => togglePack(item.id)}
                            trackColor={{
                                false: colors.glass.background,
                                true: colors.primary,
                            }}
                            thumbColor={colors.text}
                            ios_backgroundColor={colors.glass.background}
                        />
                    </View>
                </GlassCard>
            </Animated.View>
        );
    };

    return (
        <GradientBackground>
            <View style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(400)}
                    style={styles.header}
                >
                    <Text style={styles.title}>Question Packs</Text>
                    <Text style={styles.subtitle}>
                        {enabledCount} of {packs.length} packs enabled
                    </Text>
                </Animated.View>

                <FlatList
                    data={packs}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={fetchPacks}
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
                                <Ionicons name="layers-outline" size={48} color={colors.textTertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>No packs available</Text>
                            <Text style={styles.emptyText}>
                                Check back later for new question packs!
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
    card: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    cardContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    iconContainerActive: {
        backgroundColor: colors.primaryLight,
    },
    emoji: {
        fontSize: 26,
    },
    content: {
        flex: 1,
        marginRight: spacing.sm,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.xs,
    },
    name: {
        ...typography.headline,
        color: colors.text,
        marginRight: spacing.sm,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.xs,
        gap: 2,
    },
    badgeText: {
        ...typography.caption2,
        color: colors.text,
        fontWeight: "700",
    },
    description: {
        ...typography.subhead,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    questionCount: {
        ...typography.caption1,
        color: colors.textTertiary,
        marginTop: spacing.xs,
    },
    switchContainer: {
        paddingLeft: spacing.sm,
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
