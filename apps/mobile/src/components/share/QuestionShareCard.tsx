import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, spacing, typography } from "../../theme";

const logo = require("../../../assets/logo.png");

interface QuestionShareCardProps {
    question: {
        text: string;
    };
    packName?: string;
    cardColor?: string;
    cardWidth: number;
}

/**
 * The story card captured for outbound shares (Instagram Stories, Messages,
 * share sheet). Carries the question and Sauci branding only — never the
 * sharer's couple join code, which is a private pairing credential, not a
 * referral link.
 */
export function QuestionShareCard({
    question,
    packName,
    cardColor,
    cardWidth,
}: QuestionShareCardProps) {
    const useGradient = !cardColor;

    return (
        <View style={[styles.card, { width: cardWidth }]}>
            {/* Background - solid color matching what the user saw, or gradient fallback */}
            {useGradient ? (
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
            ) : (
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: cardColor, borderRadius: radius.xl },
                    ]}
                />
            )}

            {/* Subtle overlay for depth */}
            <View style={styles.overlay} />

            {/* Header: wordmark + pack badge */}
            <View style={styles.header}>
                <View style={styles.wordmark}>
                    <Image source={logo} style={styles.wordmarkLogo} />
                    <Text style={styles.wordmarkText}>Sauci</Text>
                </View>
                {packName ? (
                    <View style={styles.packBadge}>
                        <Text style={styles.packBadgeText}>{packName}</Text>
                    </View>
                ) : null}
            </View>

            {/* Question */}
            <View style={styles.content}>
                <Text style={styles.questionText}>{question.text}</Text>
            </View>

            {/* Branded footer */}
            <View style={styles.footer}>
                <Text style={styles.footerPrompt}>Play it with your partner</Text>
                <View style={styles.linkPill}>
                    <Text style={styles.linkText}>sauci.app</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        aspectRatio: 0.7,
        borderRadius: radius.xl,
        overflow: "hidden",
        padding: spacing.lg,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.1)",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    wordmark: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    wordmarkLogo: {
        width: 22,
        height: 22,
        resizeMode: "contain",
    },
    wordmarkText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "700",
    },
    packBadge: {
        flexShrink: 1,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
    packBadgeText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: "600",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        paddingVertical: spacing.xl,
    },
    questionText: {
        ...typography.title1,
        color: colors.text,
        fontWeight: "700",
        lineHeight: 36,
    },
    footer: {
        alignItems: "center",
        gap: spacing.sm,
    },
    footerPrompt: {
        ...typography.caption1,
        color: "rgba(255, 255, 255, 0.85)",
        fontWeight: "600",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    linkPill: {
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
    },
    linkText: {
        ...typography.subhead,
        color: "#1a1a2e",
        fontWeight: "700",
    },
});
