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
import { useCallback, useState, useEffect } from "react";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeInUp,
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
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
const NAV_BAR_HEIGHT = 44;
const STATUS_BAR_HEIGHT = 60;
const HEADER_SCROLL_DISTANCE = 100;

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

type GroupByOption = "pack" | "date" | "answer";

export default function MyAnswersScreen() {
    const { responses, isLoading, isLoadingMore, hasMore, groupBy, dateSortOrder, fetchResponses, setGroupBy, toggleDateSortOrder, totalCount } = useResponsesStore();
    const { user, partner } = useAuthStore();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;

    const handleBack = () => {
        const returnTo = (params.returnTo as string) || "/(app)/swipe";
        router.push(returnTo as any);
    };

    // State for edit sheet
    const [selectedResponse, setSelectedResponse] = useState<ResponseWithQuestion | null>(null);
    const [isEditSheetVisible, setIsEditSheetVisible] = useState(false);

    // Scroll animation
    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const heroStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE * 0.7],
            [1, 0],
            Extrapolation.CLAMP
        );
        const scale = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE],
            [1, 0.95],
            Extrapolation.CLAMP
        );
        return { opacity, transform: [{ scale }] };
    });

    const compactHeaderStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [HEADER_SCROLL_DISTANCE * 0.5, HEADER_SCROLL_DISTANCE],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    const navBarBackgroundStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE * 0.8],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    // Ambient orb breathing animations
    const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation();

    // Fetch responses on focus
    useFocusEffect(
        useCallback(() => {
            fetchResponses(true);
        }, [])
    );

    const handleLoadMore = useCallback(() => {
        if (!isLoading && !isLoadingMore && hasMore) {
            fetchResponses(false);
        }
    }, [isLoading, isLoadingMore, hasMore]);

    const sections = groupResponses(responses, groupBy, dateSortOrder);

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
        fetchResponses(true);
    };

    const renderSectionHeader = ({ section }: { section: any }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
    );

    const renderItem = ({ item, index }: { item: any; index: number }) => (
        <ResponseCard
            response={item}
            index={index}
            onEditPress={() => handleEditPress(item)}
            onChatPress={item.match_id ? () => router.push(`/chat/${item.match_id}`) : undefined}
            viewerId={user?.id}
            viewerName={user?.name}
            partnerName={partner?.name}
        />
    );

    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.primary} size="small" />
            </View>
        );
    };

    const GroupByButton = ({ option, label }: { option: GroupByOption; label: string }) => {
        const isActive = groupBy === option;
        const isDateButton = option === "date";
        const showChevron = isDateButton && isActive;

        const handlePress = () => {
            if (isDateButton && isActive) {
                // Toggle sort order when date is already selected
                toggleDateSortOrder();
            } else {
                setGroupBy(option);
            }
        };

        return (
            <TouchableOpacity
                style={[styles.groupByButton, isActive && styles.groupByButtonActive]}
                onPress={handlePress}
            >
                <Text style={[styles.groupByText, isActive && styles.groupByTextActive]}>
                    {label}
                </Text>
                {showChevron && (
                    <Ionicons
                        name={dateSortOrder === "newest" ? "chevron-down" : "chevron-up"}
                        size={14}
                        color={ACCENT}
                        style={styles.sortChevron}
                    />
                )}
            </TouchableOpacity>
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
            {/* Ambient Orbs - Commented out for flat look
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
            */}

            <View style={styles.container}>
                {/* Fixed Nav Bar */}
                <View style={styles.navBar}>
                    <Animated.View style={[styles.navBarBackground, navBarBackgroundStyle]}>
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
                    </Animated.View>
                    
                    <TouchableOpacity style={styles.navBarBackButton} onPress={handleBack}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>

                    <Animated.Text style={[styles.navBarTitle, compactHeaderStyle]} numberOfLines={1}>
                        My Answers
                    </Animated.Text>
                </View>

                {isLoading && responses.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={colors.primary} size="large" />
                    </View>
                ) : (
                    <AnimatedSectionList
                        sections={sections}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        keyExtractor={(item: any) => item.id}
                        contentContainerStyle={[styles.list, isWideScreen && styles.listWide]}
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={false}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={isLoading}
                                onRefresh={() => fetchResponses(true)}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                                progressViewOffset={STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT}
                            />
                        }
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={2}
                        ListFooterComponent={renderFooter}
                        ListHeaderComponent={
                            <Animated.View
                                entering={FadeIn.duration(400)}
                                style={[styles.header, isWideScreen && styles.headerWide, heroStyle]}
                            >
                                <View style={styles.headerContent}>
                                    <Text style={styles.headerLabel}>REVIEW</Text>
                                    <Text style={styles.headerTitle}>My Answers</Text>
                                    <DecorativeSeparator variant="gold" />

                                    {/* Count badge */}
                                    <View style={styles.countBadgePremium}>
                                        <Ionicons name="checkmark-circle" size={12} color={ACCENT} />
                                        <Text style={styles.countTextPremium}>
                                            {totalCount ?? responses.length} {(totalCount ?? responses.length) === 1 ? "ANSWER" : "ANSWERS"}
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
                                    onPress={() => router.push("/")}
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
    // Fixed Nav Bar
    navBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: STATUS_BAR_HEIGHT - 10,
        paddingHorizontal: spacing.md,
        zIndex: 100,
    },
    navBarBackground: {
        ...StyleSheet.absoluteFillObject,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
        overflow: "hidden",
    },
    navBarBackButton: {
        position: "absolute",
        top: STATUS_BAR_HEIGHT - 5,
        left: spacing.md,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.backgroundLight,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    countBadgePremium: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
    },
    // ...
    groupByButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    groupByButtonActive: {
        backgroundColor: colors.background,
        borderColor: colors.primary,
    },
    // ...
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.backgroundLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },

    navBarTitle: {
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
    },
    // Header (Hero)
    header: {
        paddingTop: STATUS_BAR_HEIGHT + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        alignItems: 'center',
    },
    headerWide: {
        alignSelf: "center",
        width: "100%",
        maxWidth: MAX_CONTENT_WIDTH,
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


    groupByText: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    groupByTextActive: {
        color: ACCENT,
        fontWeight: "600",
    },
    sortChevron: {
        marginLeft: spacing.xs,
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
        paddingTop: 0, // Header handles top spacing
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
    footerLoader: {
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
});
