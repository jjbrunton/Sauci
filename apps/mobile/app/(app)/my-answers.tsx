import {
    View,
    Text,
    StyleSheet,
    SectionList,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    useWindowDimensions,
} from "react-native";
import { useResponsesStore, groupResponses, useAuthStore } from "../../src/store";
import type { ResponseWithQuestion } from "../../src/store";
import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { GradientBackground, GlassButton, DecorativeSeparator } from "../../src/components/ui";
import { useAmbientOrbAnimation } from "../../src/hooks";
import { colors, spacing, typography, radius } from "../../src/theme";
import { ResponseCard } from "../../src/components/responses/ResponseCard";
import { EditResponseSheet } from "../../src/components/responses/EditResponseSheet";

// Premium color palette
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = "rgba(212, 175, 55, ";
const ROSE = colors.premium.rose;
const ROSE_RGBA = "rgba(232, 164, 174, ";

const MAX_CONTENT_WIDTH = 500;

type GroupByOption = "pack" | "date" | "answer";

export default function MyAnswersScreen() {
    const { responses, isLoading, groupBy, fetchResponses, setGroupBy } = useResponsesStore();
    const { user } = useAuthStore();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;

    // State for edit sheet
    const [selectedResponse, setSelectedResponse] = useState<ResponseWithQuestion | null>(null);
    const [isEditSheetVisible, setIsEditSheetVisible] = useState(false);

    // Ambient orb breathing animations
    const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation();

    // Fetch responses on focus
    useFocusEffect(
        useCallback(() => {
            fetchResponses();
        }, [])
    );

    const sections = groupResponses(responses, groupBy);

    const handleEditPress = (response: ResponseWithQuestion) => {
        setSelectedResponse(response);
        setIsEditSheetVisible(true);
    };

    const handleEditClose = () => {
        setIsEditSheetVisible(false);
        setSelectedResponse(null);
    };

    const handleEditSuccess = () => {
        // Refetch responses to get updated data
        fetchResponses();
    };

    const renderSectionHeader = ({ section }: { section: { title: string } }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
    );

    const renderItem = ({ item, index }: { item: ResponseWithQuestion; index: number }) => (
        <ResponseCard
            response={item}
            index={index}
            onEditPress={() => handleEditPress(item)}
            onChatPress={item.match_id ? () => router.push(`/chat/${item.match_id}`) : undefined}
        />
    );

    const GroupByButton = ({ option, label }: { option: GroupByOption; label: string }) => (
        <TouchableOpacity
            style={[styles.groupByButton, groupBy === option && styles.groupByButtonActive]}
            onPress={() => setGroupBy(option)}
        >
            <Text style={[styles.groupByText, groupBy === option && styles.groupByTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

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
            {/* Ambient Orbs */}
            <Animated.View
                style={[styles.ambientOrb, styles.orbTopRight, orbStyle1]}
                pointerEvents="none"
            >
                <LinearGradient
                    colors={[colors.premium.goldGlow, "transparent"]}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>
            <Animated.View
                style={[styles.ambientOrb, styles.orbBottomLeft, orbStyle2]}
                pointerEvents="none"
            >
                <LinearGradient
                    colors={[`${ROSE_RGBA}0.2)`, "transparent"]}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0, y: 0 }}
                />
            </Animated.View>

            <View style={styles.container}>
                {/* Header */}
                <Animated.View
                    entering={FadeIn.duration(400)}
                    style={[styles.header, isWideScreen && styles.headerWide]}
                >
                    {/* Back button */}
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerContent}>
                        <Text style={styles.headerLabel}>REVIEW</Text>
                        <Text style={styles.headerTitle}>My Answers</Text>
                        <DecorativeSeparator variant="gold" />

                        {/* Count badge */}
                        <View style={styles.countBadgePremium}>
                            <Ionicons name="checkmark-circle" size={12} color={ACCENT} />
                            <Text style={styles.countTextPremium}>
                                {responses.length} {responses.length === 1 ? "ANSWER" : "ANSWERS"}
                            </Text>
                        </View>
                    </View>

                    {/* Group by buttons */}
                    <View style={styles.groupByContainer}>
                        <GroupByButton option="pack" label="Pack" />
                        <GroupByButton option="date" label="Date" />
                        <GroupByButton option="answer" label="Answer" />
                    </View>
                </Animated.View>

                {isLoading && responses.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={colors.primary} size="large" />
                    </View>
                ) : (
                    <SectionList
                        sections={sections}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={[styles.list, isWideScreen && styles.listWide]}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={isLoading}
                                onRefresh={fetchResponses}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <Animated.View
                                entering={FadeInUp.duration(600).springify()}
                                style={styles.emptyContent}
                            >
                                <View style={styles.emptyIcon}>
                                    <Ionicons name="help-circle-outline" size={48} color={ACCENT} />
                                </View>
                                <Text style={styles.emptyTitle}>No Answers Yet</Text>
                                <Text style={styles.emptyDescription}>
                                    Start swiping on questions to build your answer history. You can
                                    come back here to review and change your answers anytime.
                                </Text>
                                <GlassButton
                                    onPress={() => router.push("/(app)/swipe")}
                                    style={{ marginTop: spacing.lg }}
                                >
                                    Start Swiping
                                </GlassButton>
                            </Animated.View>
                        }
                    />
                )}
            </View>

            {/* Edit Response Sheet */}
            <EditResponseSheet
                visible={isEditSheetVisible}
                response={selectedResponse}
                onClose={handleEditClose}
                onSuccess={handleEditSuccess}
            />
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
    // Ambient orbs
    ambientOrb: {
        position: "absolute",
        width: 300,
        height: 300,
        borderRadius: 150,
    },
    orbTopRight: {
        top: 60,
        right: -40,
    },
    orbBottomLeft: {
        bottom: 180,
        left: -40,
    },
    orbGradient: {
        width: "100%",
        height: "100%",
        borderRadius: 150,
    },
    // Header
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerWide: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_CONTENT_WIDTH,
    },
    backButton: {
        position: "absolute",
        top: 60,
        left: spacing.md,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    headerContent: {
        alignItems: "center",
    },
    headerLabel: {
        ...typography.caption2,
        fontWeight: "600",
        letterSpacing: 3,
        color: ACCENT,
        marginBottom: spacing.xs,
    },
    headerTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: "center",
    },
    countBadgePremium: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.2)`,
        gap: spacing.xs,
    },
    countTextPremium: {
        ...typography.caption2,
        fontWeight: "600",
        letterSpacing: 2,
        color: ACCENT,
    },
    // Group by buttons
    groupByContainer: {
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    groupByButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    groupByButtonActive: {
        backgroundColor: `${ACCENT_RGBA}0.15)`,
        borderColor: `${ACCENT_RGBA}0.3)`,
    },
    groupByText: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    groupByTextActive: {
        color: ACCENT,
        fontWeight: "600",
    },
    // Section header
    sectionHeader: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    sectionTitle: {
        ...typography.title3,
        color: colors.text,
    },
    // List
    list: {
        padding: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: Platform.OS === "ios" ? 120 : 100,
    },
    listWide: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_CONTENT_WIDTH,
    },
    // Empty state
    emptyContent: {
        width: "100%",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xxl,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        ...typography.title2,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptyDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        paddingHorizontal: spacing.md,
    },
});
