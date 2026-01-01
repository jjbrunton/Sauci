import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { GradientBackground } from "../../../src/components/ui";
import { usePacksStore } from "../../../src/store";
import { colors, spacing, radius, typography, shadows } from "../../../src/theme";

interface PackTypeCard {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    colorRgba: string;
    gradient: [string, string];
    comingSoon: boolean;
    route?: string;
}

const PACK_TYPES: PackTypeCard[] = [
    {
        id: "questions",
        title: "Question Packs",
        description: "Explore intimate questions together and discover what you both want",
        icon: "layers",
        color: colors.primary,
        colorRgba: "rgba(233, 69, 96, ",
        gradient: ["rgba(233, 69, 96, 0.25)", "rgba(155, 89, 182, 0.25)"],
        comingSoon: false,
        route: "/(app)/packs/questions",
    },
    {
        id: "dares",
        title: "Dare Packs",
        description: "Spice things up with exciting dares for adventurous couples",
        icon: "flash",
        color: colors.premium.gold,
        colorRgba: "rgba(212, 175, 55, ",
        gradient: ["rgba(212, 175, 55, 0.25)", "rgba(184, 134, 11, 0.25)"],
        comingSoon: true,
    },
    {
        id: "quiz",
        title: "Quiz Packs",
        description: "Test how well you know each other with fun couple quizzes",
        icon: "help-circle",
        color: colors.premium.rose,
        colorRgba: "rgba(232, 164, 174, ",
        gradient: ["rgba(232, 164, 174, 0.25)", "rgba(212, 145, 155, 0.25)"],
        comingSoon: true,
    },
];

export default function PackTypeSelection() {
    const { fetchPacks } = usePacksStore();

    // Prefetch packs data so it's ready when navigating to questions
    useEffect(() => {
        fetchPacks();
    }, []);

    const handlePackTypePress = (packType: PackTypeCard) => {
        if (!packType.comingSoon && packType.route) {
            router.push(packType.route as any);
        }
    };

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.duration(600).springify()}
                    style={styles.header}
                >
                    <Text style={styles.label}>EXPLORE</Text>
                    <Text style={styles.title}>Content Packs</Text>

                    {/* Decorative Separator */}
                    <View style={styles.separator}>
                        <View style={styles.separatorLine} />
                        <View style={styles.separatorDiamond} />
                        <View style={styles.separatorLine} />
                    </View>

                    <Text style={styles.subtitle}>
                        Choose a pack type to explore
                    </Text>
                </Animated.View>

                {/* Pack Type Cards */}
                <View style={styles.cardsContainer}>
                    {PACK_TYPES.map((packType, index) => (
                        <Animated.View
                            key={packType.id}
                            entering={FadeInDown.delay(100 + index * 100).duration(500).springify()}
                        >
                            <Pressable
                                onPress={() => handlePackTypePress(packType)}
                                style={({ pressed }) => [
                                    styles.card,
                                    pressed && !packType.comingSoon && styles.cardPressed,
                                    packType.comingSoon && styles.cardDisabled,
                                ]}
                                disabled={packType.comingSoon}
                            >
                                <LinearGradient
                                    colors={packType.gradient as [string, string]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.cardGradient}
                                >
                                    {/* Icon Circle */}
                                    <View
                                        style={[
                                            styles.iconCircle,
                                            {
                                                backgroundColor: `${packType.colorRgba}0.15)`,
                                                borderColor: `${packType.colorRgba}0.3)`,
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name={packType.icon}
                                            size={32}
                                            color={packType.comingSoon ? colors.textTertiary : packType.color}
                                        />
                                    </View>

                                    {/* Content */}
                                    <View style={styles.cardContent}>
                                        <View style={styles.cardTitleRow}>
                                            <Text
                                                style={[
                                                    styles.cardTitle,
                                                    packType.comingSoon && styles.cardTitleDisabled,
                                                ]}
                                            >
                                                {packType.title}
                                            </Text>
                                            {packType.comingSoon && (
                                                <View style={styles.comingSoonBadge}>
                                                    <Text style={styles.comingSoonText}>Coming Soon</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text
                                            style={[
                                                styles.cardDescription,
                                                packType.comingSoon && styles.cardDescriptionDisabled,
                                            ]}
                                        >
                                            {packType.description}
                                        </Text>
                                    </View>

                                    {/* Arrow */}
                                    {!packType.comingSoon && (
                                        <Ionicons
                                            name="chevron-forward"
                                            size={24}
                                            color={colors.textSecondary}
                                        />
                                    )}
                                </LinearGradient>
                            </Pressable>
                        </Animated.View>
                    ))}
                </View>
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
        paddingBottom: spacing.lg,
        alignItems: "center",
    },
    label: {
        ...typography.caption1,
        fontWeight: "600",
        letterSpacing: 3,
        color: colors.primary,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
    },
    separator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: spacing.md,
        width: 140,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: "rgba(233, 69, 96, 0.3)",
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: colors.primary,
        transform: [{ rotate: "45deg" }],
        marginHorizontal: spacing.md,
        opacity: 0.6,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
    cardsContainer: {
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    card: {
        borderRadius: radius.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.glass.border,
        ...shadows.md,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    cardDisabled: {
        opacity: 0.6,
    },
    cardGradient: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.lg,
        gap: spacing.md,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    cardContent: {
        flex: 1,
    },
    cardTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    cardTitle: {
        ...typography.title3,
        color: colors.text,
    },
    cardTitleDisabled: {
        color: colors.textSecondary,
    },
    cardDescription: {
        ...typography.subhead,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    cardDescriptionDisabled: {
        color: colors.textTertiary,
    },
    comingSoonBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
    },
    comingSoonText: {
        ...typography.caption2,
        color: colors.textTertiary,
        fontWeight: "500",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
});
