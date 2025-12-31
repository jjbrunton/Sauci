import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, Pressable, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { supabase } from "../../src/lib/supabase";
import { usePacksStore, useSubscriptionStore, useAuthStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { GradientBackground, GlassCard, ShimmerEffect } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography, blur, shadows } from "../../src/theme";
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

// Boutique gradient for question cards
const QUESTION_GRADIENTS: Array<readonly [string, string]> = [
    ['rgba(233, 69, 96, 0.15)', 'rgba(155, 89, 182, 0.15)'],
    ['rgba(155, 89, 182, 0.15)', 'rgba(233, 69, 96, 0.15)'],
    ['rgba(183, 110, 121, 0.12)', 'rgba(139, 69, 87, 0.12)'],
    ['rgba(142, 68, 173, 0.12)', 'rgba(44, 62, 80, 0.12)'],
];

export default function PackDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { packs, fetchPacks } = usePacksStore();
    const { subscription } = useSubscriptionStore();
    const { user, partner } = useAuthStore();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTooltip, setActiveTooltip] = useState<TooltipType>(null);

    const pack = packs.find((p) => p.id === id);
    const hasPremiumAccess = user?.is_premium || partner?.is_premium || subscription.isProUser;
    const isPremium = pack?.is_premium && hasPremiumAccess;

    // Get category for breadcrumb
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

    const useBlur = Platform.OS === 'ios';

    const renderItem = ({ item, index }: { item: Question; index: number }) => {
        const cardGradient = QUESTION_GRADIENTS[index % QUESTION_GRADIENTS.length];

        return (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
                <GlassCard style={styles.questionCard}>
                    {/* Subtle gradient overlay */}
                    <LinearGradient
                        colors={cardGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.questionContent}>
                        <Text style={styles.questionText}>{item.text}</Text>

                        {item.partner_text && (
                            <View style={styles.partnerTextContainer}>
                                <Ionicons name="swap-horizontal" size={14} color={colors.premium.rose} />
                                <Text style={styles.partnerText}>{item.partner_text}</Text>
                            </View>
                        )}

                        <View style={styles.footerContainer}>
                            {/* Intensity */}
                            <View style={styles.intensityContainer}>
                                {[...Array(5)].map((_, i) => (
                                    <Ionicons
                                        key={i}
                                        name="flame"
                                        size={14}
                                        color={i < item.intensity ? colors.primary : colors.textTertiary}
                                        style={{ marginRight: 2 }}
                                    />
                                ))}
                            </View>

                            <View style={styles.badgesContainer}>
                                {/* Initiator indicator */}
                                {item.target_user_genders && item.target_user_genders.length > 0 && (
                                    <Pressable
                                        style={styles.targetBadge}
                                        onPress={() => setActiveTooltip('initiator')}
                                    >
                                        <Ionicons name="arrow-forward" size={12} color={colors.premium.gold} style={{ marginRight: 4 }} />
                                        {item.target_user_genders.map((g, i) => (
                                            <Ionicons
                                                key={g}
                                                name={g === 'male' ? 'male' : g === 'female' ? 'female' : 'person'}
                                                size={14}
                                                color={colors.premium.gold}
                                                style={i > 0 ? { marginLeft: 4 } : {}}
                                            />
                                        ))}
                                        <Ionicons name="help-circle-outline" size={12} color={colors.premium.gold} style={{ marginLeft: 4 }} />
                                    </Pressable>
                                )}

                                {/* Couple type indicator */}
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
                                                            size={14}
                                                            color={colors.textSecondary}
                                                            style={i > 0 ? { marginLeft: 2 } : {}}
                                                        />
                                                    ))}
                                                </View>
                                            );
                                        })
                                    ) : (
                                        <Ionicons name="people" size={14} color={colors.textSecondary} />
                                    )}
                                    <Ionicons name="help-circle-outline" size={12} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </GlassCard>
            </Animated.View>
        );
    };

    if (isLoading) {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    const heroContent = (
        <View style={styles.heroInner}>
            {/* Background gradient */}
            <LinearGradient
                colors={isPremium ? gradients.boutiqueGold as [string, string] : gradients.boutiqueRose as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Glass overlay */}
            {useBlur ? (
                <BlurView
                    intensity={blur.light}
                    tint="dark"
                    style={[StyleSheet.absoluteFill, styles.heroBlur]}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, styles.heroBlurFallback]} />
            )}

            {/* Silk texture */}
            <LinearGradient
                colors={gradients.silkLight as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
            />

            {/* Back button */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <View style={styles.backButtonInner}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </View>
            </TouchableOpacity>

            {/* Pack info */}
            <View style={styles.heroContent}>
                <View style={[
                    styles.iconContainer,
                    isPremium && styles.iconContainerPremium
                ]}>
                    <Text style={styles.emoji}>{pack?.icon || "📦"}</Text>
                </View>

                {pack?.is_premium && (
                    <View style={styles.proBadge}>
                        <Ionicons name="star" size={12} color={colors.text} />
                        <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                )}

                {/* Category breadcrumb - tappable to filter by category */}
                {category && (
                    <TouchableOpacity
                        style={styles.breadcrumb}
                        onPress={() => router.replace(`/(app)/packs?category=${category.id}`)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.breadcrumbText}>{category.icon} {category.name}</Text>
                        <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}

                <Text style={styles.title}>{pack?.name || "Pack Details"}</Text>
                <Text style={styles.description}>{pack?.description}</Text>

                <View style={styles.statsBadge}>
                    <Text style={styles.statsText}>{questions.length} questions</Text>
                </View>
            </View>
        </View>
    );

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Hero Section */}
                <Animated.View entering={FadeIn.duration(400)}>
                    {isPremium ? (
                        <ShimmerEffect enabled={true} style={styles.heroContainer}>
                            {heroContent}
                        </ShimmerEffect>
                    ) : (
                        <View style={styles.heroContainer}>
                            {heroContent}
                        </View>
                    )}
                </Animated.View>

                {/* Questions List */}
                <FlatList
                    data={questions}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
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
    heroContainer: {
        borderBottomLeftRadius: radius.xl,
        borderBottomRightRadius: radius.xl,
        overflow: 'hidden',
        ...shadows.lg,
    },
    heroInner: {
        paddingTop: 50,
        paddingBottom: spacing.lg,
        minHeight: 260,
    },
    heroBlur: {
        backgroundColor: 'rgba(22, 33, 62, 0.4)',
    },
    heroBlurFallback: {
        backgroundColor: 'rgba(22, 33, 62, 0.6)',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: spacing.md,
        zIndex: 10,
    },
    backButtonInner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    heroContent: {
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    iconContainerPremium: {
        borderColor: colors.premium.gold,
        backgroundColor: colors.premium.goldLight,
    },
    emoji: {
        fontSize: 40,
    },
    proBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.premium.gold,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
        gap: 4,
        marginBottom: spacing.sm,
    },
    proBadgeText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '700',
    },
    breadcrumb: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: spacing.xs,
    },
    breadcrumbText: {
        ...typography.caption1,
        color: colors.textSecondary,
    },
    title: {
        ...typography.title2,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: spacing.md,
    },
    statsBadge: {
        marginTop: spacing.md,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    statsText: {
        ...typography.subhead,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    list: {
        padding: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    questionCard: {
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    questionContent: {
        padding: spacing.md,
    },
    questionText: {
        ...typography.body,
        color: colors.text,
        marginBottom: spacing.sm,
        lineHeight: 24,
    },
    partnerTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.premium.roseLight,
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
    },
    intensityContainer: {
        flexDirection: 'row',
    },
    badgesContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    targetBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
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
