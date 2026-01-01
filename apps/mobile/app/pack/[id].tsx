import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, Pressable, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { supabase } from "../../src/lib/supabase";
import { usePacksStore, useSubscriptionStore, useAuthStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography } from "../../src/theme";
import { Question } from "../../src/types";

type TooltipType = 'initiator' | 'coupleType' | null;

const TOOLTIP_CONTENT = {
    initiator: {
        title: 'Initiator Filter',
        description: 'The "initiator" is the first person in the couple to see and answer this question. This icon shows which genders can be the initiator. Their partner will always see the question afterward, regardless of this setting.',
    },
    coupleType: {
        title: 'Couple Type Filter',
        description: 'This shows which couple compositions can see this question. For example, a male+female icon means the question is only shown to couples where one partner is male and one is female.',
    },
};

const ACCENT_COLOR = colors.primary;

const NAV_BAR_HEIGHT = 44;
const STATUS_BAR_HEIGHT = 60;
const HERO_HEIGHT = 260;
const HEADER_SCROLL_DISTANCE = 120;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Question>);

export default function PackDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { packs, fetchPacks } = usePacksStore();
    const { subscription } = useSubscriptionStore();
    const { user, partner } = useAuthStore();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTooltip, setActiveTooltip] = useState<TooltipType>(null);

    const scrollY = useSharedValue(0);

    const pack = packs.find((p) => p.id === id);
    const hasPremiumAccess = user?.is_premium || partner?.is_premium || subscription.isProUser;
    const isPremium = pack?.is_premium && hasPremiumAccess;

    const { categories } = usePacksStore();
    const category = categories.find(c => c.id === pack?.category_id);

    useEffect(() => {
        if (packs.length === 0) {
            fetchPacks();
        }
        fetchPackDetails();
    }, [id]);

    const fetchPackDetails = async () => {
        try {
            const { data, error } = await supabase
                .from("questions")
                .select("*")
                .eq("pack_id", id)
                .order("created_at");

            if (error) throw error;
            setQuestions(data || []);
        } catch (error) {
            console.error("Error fetching questions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // Animated styles for collapsing header
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

    const useBlur = Platform.OS === 'ios';

    const renderItem = ({ item, index }: { item: Question; index: number }) => {
        return (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
                <View style={styles.questionCard}>
                    <View style={styles.questionContent}>
                        <Text style={styles.questionNumber}>#{index + 1}</Text>
                        <Text style={styles.questionText}>{item.text}</Text>

                        {item.partner_text && (
                            <View style={styles.partnerTextContainer}>
                                <Ionicons name="swap-horizontal" size={14} color={colors.premium.rose} />
                                <Text style={styles.partnerText}>{item.partner_text}</Text>
                            </View>
                        )}

                        <View style={styles.footerContainer}>
                            <View style={styles.intensityContainer}>
                                {[...Array(5)].map((_, i) => (
                                    <Ionicons
                                        key={i}
                                        name="flame"
                                        size={12}
                                        color={i < item.intensity ? ACCENT_COLOR : 'rgba(255, 255, 255, 0.15)'}
                                        style={{ marginRight: 2 }}
                                    />
                                ))}
                            </View>

                            <View style={styles.badgesContainer}>
                                {item.target_user_genders && item.target_user_genders.length > 0 && (
                                    <Pressable
                                        style={styles.targetBadge}
                                        onPress={() => setActiveTooltip('initiator')}
                                    >
                                        <Ionicons name="arrow-forward" size={10} color={colors.textTertiary} style={{ marginRight: 2 }} />
                                        {item.target_user_genders.map((g, i) => (
                                            <Ionicons
                                                key={g}
                                                name={g === 'male' ? 'male' : g === 'female' ? 'female' : 'person'}
                                                size={12}
                                                color={colors.textTertiary}
                                                style={i > 0 ? { marginLeft: 2 } : {}}
                                            />
                                        ))}
                                    </Pressable>
                                )}

                                <Pressable
                                    style={styles.targetBadge}
                                    onPress={() => setActiveTooltip('coupleType')}
                                >
                                    {item.allowed_couple_genders && item.allowed_couple_genders.length > 0 ? (
                                        item.allowed_couple_genders.map((g) => {
                                            const icons: ('male' | 'female')[] = [];
                                            if (g === 'male+male') {
                                                icons.push('male', 'male');
                                            } else if (g === 'female+female') {
                                                icons.push('female', 'female');
                                            } else {
                                                icons.push('male', 'female');
                                            }

                                            return (
                                                <View key={g} style={styles.coupleIconGroup}>
                                                    {icons.map((icon, i) => (
                                                        <Ionicons
                                                            key={i}
                                                            name={icon}
                                                            size={12}
                                                            color={colors.textTertiary}
                                                            style={i > 0 ? { marginLeft: 2 } : {}}
                                                        />
                                                    ))}
                                                </View>
                                            );
                                        })
                                    ) : (
                                        <Ionicons name="people" size={12} color={colors.textTertiary} />
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            </Animated.View>
        );
    };

    const heroContent = (
        <View style={styles.heroInner}>
            {/* Premium Banner */}
            {pack?.is_premium && (
                <View style={styles.premiumBanner}>
                    <LinearGradient
                        colors={[colors.premium.gold, colors.premium.goldDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.premiumBannerContent}>
                        <Ionicons name="diamond" size={16} color={colors.background} />
                        <Text style={styles.premiumBannerText}>PREMIUM COLLECTION</Text>
                        <Ionicons name="diamond" size={16} color={colors.background} />
                    </View>
                </View>
            )}

            <View style={styles.heroContent}>
                {/* Category label */}
                <Text style={[styles.label, pack?.is_premium && styles.labelPremium]}>
                    {category ? category.name.toUpperCase() : 'PREVIEW'}
                </Text>

                {/* Icon with enhanced glow for premium */}
                <View style={styles.iconWrapper}>
                    {pack?.is_premium && (
                        <>
                            <View style={styles.iconGlowOuter} />
                            <View style={styles.iconGlow} />
                        </>
                    )}
                    <View style={[
                        styles.iconContainer,
                        pack?.is_premium && styles.iconContainerPremium
                    ]}>
                        {pack?.is_premium && (
                            <LinearGradient
                                colors={['rgba(212, 175, 55, 0.2)', 'rgba(184, 134, 11, 0.1)']}
                                style={StyleSheet.absoluteFill}
                            />
                        )}
                        <Text style={styles.emoji}>{pack?.icon || "📦"}</Text>
                    </View>
                    {/* Crown for premium */}
                    {pack?.is_premium && (
                        <View style={styles.crownBadge}>
                            <Ionicons name="star" size={14} color={colors.premium.gold} />
                        </View>
                    )}
                </View>

                {/* Title */}
                <Text style={[styles.title, pack?.is_premium && styles.titlePremium]}>
                    {pack?.name || "Pack Details"}
                </Text>

                {/* Premium badge - larger and more prominent */}
                {pack?.is_premium && (
                    <View style={styles.proBadge}>
                        <LinearGradient
                            colors={[colors.premium.gold, colors.premium.goldDark]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[StyleSheet.absoluteFill, { borderRadius: radius.full }]}
                        />
                        <Ionicons name="star" size={12} color={colors.background} />
                        <Text style={styles.proBadgeText}>PREMIUM</Text>
                        <Ionicons name="star" size={12} color={colors.background} />
                    </View>
                )}

                {/* Decorative separator */}
                <View style={styles.separator}>
                    <View style={[styles.separatorLine, pack?.is_premium && styles.separatorLinePremium]} />
                    <View style={[styles.separatorDiamond, pack?.is_premium && styles.separatorDiamondPremium]} />
                    <View style={[styles.separatorLine, pack?.is_premium && styles.separatorLinePremium]} />
                </View>

                {/* Description */}
                <Text style={styles.description}>{pack?.description}</Text>

                {/* Stats badge */}
                <View style={[styles.statsBadge, pack?.is_premium && styles.statsBadgePremium]}>
                    <Ionicons name="help-circle-outline" size={14} color={pack?.is_premium ? colors.premium.gold : ACCENT_COLOR} />
                    <Text style={[styles.statsText, pack?.is_premium && styles.statsTextPremium]}>{questions.length} questions</Text>
                </View>
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Fixed Nav Bar */}
                <View style={styles.navBar}>
                    <Animated.View style={[styles.navBarBackground, navBarBackgroundStyle]}>
                        {Platform.OS === "ios" ? (
                            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                        ) : (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(13, 13, 26, 0.95)" }]} />
                        )}
                    </Animated.View>

                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <View style={styles.backButtonInner}>
                            <Ionicons name="chevron-back" size={22} color={colors.text} />
                        </View>
                    </TouchableOpacity>

                    <Animated.Text style={[styles.navBarTitle, compactHeaderStyle]} numberOfLines={1}>
                        {pack?.name || "Pack Details"}
                    </Animated.Text>

                    <View style={styles.navBarSpacer} />
                </View>

                {/* Questions List with Hero Header */}
                <AnimatedFlatList
                    data={questions}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    contentContainerStyle={styles.list}
                    ListHeaderComponent={
                        <Animated.View style={[styles.heroContainer, heroStyle]}>
                            {heroContent}
                        </Animated.View>
                    }
                    ListEmptyComponent={
                        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.emptyContainer}>
                            <Ionicons name="help-circle-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyText}>No questions in this pack yet</Text>
                        </Animated.View>
                    }
                />

                {/* Tooltip Modal */}
                <Modal
                    visible={activeTooltip !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setActiveTooltip(null)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setActiveTooltip(null)}
                    >
                        <GlassCard style={styles.tooltipContainer}>
                            <LinearGradient
                                colors={gradients.laceTint as [string, string]}
                                style={StyleSheet.absoluteFill}
                            />
                            <Text style={styles.tooltipTitle}>
                                {activeTooltip && TOOLTIP_CONTENT[activeTooltip].title}
                            </Text>
                            <Text style={styles.tooltipDescription}>
                                {activeTooltip && TOOLTIP_CONTENT[activeTooltip].description}
                            </Text>
                            <TouchableOpacity
                                style={styles.tooltipButton}
                                onPress={() => setActiveTooltip(null)}
                            >
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.tooltipButtonGradient}
                                >
                                    <Text style={styles.tooltipButtonText}>Got it</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </GlassCard>
                    </Pressable>
                </Modal>
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

    // Fixed Nav Bar
    navBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        paddingTop: STATUS_BAR_HEIGHT - 10,
        paddingHorizontal: spacing.md,
        zIndex: 100,
    },
    navBarBackground: {
        ...StyleSheet.absoluteFillObject,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(233, 69, 96, 0.15)',
        overflow: "hidden",
    },
    backButton: {
        zIndex: 10,
    },
    backButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    navBarTitle: {
        flex: 1,
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
        marginRight: 36,
    },
    navBarSpacer: {
        width: 0,
    },

    // Hero Section
    heroContainer: {
        marginBottom: spacing.lg,
    },
    heroInner: {
        paddingTop: STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT + spacing.md,
        paddingBottom: spacing.lg,
        minHeight: HERO_HEIGHT,
    },
    heroContent: {
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },

    // Premium Banner
    premiumBanner: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        borderRadius: radius.md,
        overflow: 'hidden',
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    premiumBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    premiumBannerText: {
        ...typography.caption1,
        fontWeight: '800',
        letterSpacing: 2,
        color: colors.background,
    },

    label: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 3,
        color: ACCENT_COLOR,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    labelPremium: {
        color: colors.premium.gold,
    },
    iconWrapper: {
        position: 'relative',
        marginBottom: spacing.md,
    },
    iconGlowOuter: {
        position: 'absolute',
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        borderRadius: 60,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    iconGlow: {
        position: 'absolute',
        top: -10,
        left: -10,
        right: -10,
        bottom: -10,
        borderRadius: 50,
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    iconContainerPremium: {
        borderColor: colors.premium.gold,
        borderWidth: 2,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
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
    emoji: {
        fontSize: 36,
    },
    title: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    titlePremium: {
        textShadowColor: 'rgba(212, 175, 55, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    proBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        gap: spacing.xs,
        marginBottom: spacing.sm,
        overflow: 'hidden',
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
    },
    proBadgeText: {
        ...typography.caption1,
        color: colors.background,
        fontWeight: '800',
        letterSpacing: 1.5,
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
        backgroundColor: 'rgba(233, 69, 96, 0.25)',
    },
    separatorLinePremium: {
        backgroundColor: 'rgba(212, 175, 55, 0.4)',
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: ACCENT_COLOR,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.md,
        opacity: 0.6,
    },
    separatorDiamondPremium: {
        backgroundColor: colors.premium.gold,
        opacity: 1,
    },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    statsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(233, 69, 96, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: 'rgba(233, 69, 96, 0.2)',
    },
    statsBadgePremium: {
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    statsText: {
        ...typography.subhead,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    statsTextPremium: {
        color: colors.premium.champagne,
    },

    // List
    list: {
        paddingHorizontal: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    questionCard: {
        backgroundColor: 'rgba(22, 33, 62, 0.4)',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginBottom: spacing.sm,
    },
    questionContent: {
        padding: spacing.md,
    },
    questionNumber: {
        ...typography.caption2,
        color: colors.textTertiary,
        marginBottom: spacing.xs,
    },
    questionText: {
        ...typography.body,
        color: colors.text,
        marginBottom: spacing.sm,
        lineHeight: 22,
    },
    partnerTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: 'rgba(232, 164, 174, 0.1)',
        borderRadius: radius.sm,
        alignSelf: 'flex-start',
    },
    partnerText: {
        ...typography.caption1,
        color: colors.premium.rose,
        fontStyle: 'italic',
    },
    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.04)',
    },
    intensityContainer: {
        flexDirection: 'row',
    },
    badgesContainer: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    targetBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
    },
    coupleIconGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        gap: spacing.md,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    tooltipContainer: {
        maxWidth: 320,
        overflow: 'hidden',
    },
    tooltipTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    tooltipDescription: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.lg,
    },
    tooltipButton: {
        borderRadius: radius.md,
        overflow: 'hidden',
    },
    tooltipButtonGradient: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    tooltipButtonText: {
        ...typography.headline,
        color: colors.text,
    },
});
