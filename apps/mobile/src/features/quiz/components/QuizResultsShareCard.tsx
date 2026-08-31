import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { featureColors, radius, spacing, typography } from "../../../theme";

const logo = require("../../../../assets/logo.png");

interface QuizResultsShareCardProps {
    scorePercent: number;
    cardWidth: number;
}

/**
 * The card captured for sharing. Deliberately carries only the score, never the
 * question text or answers, so a screenshot cannot leak either partner's content.
 */
export function QuizResultsShareCard({ scorePercent, cardWidth }: QuizResultsShareCardProps) {
    return (
        <View style={[styles.card, { width: cardWidth }]}>
            <LinearGradient
                colors={featureColors.quiz.gradient as [string, string]}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.overlay} />

                <View style={styles.content}>
                    <Text style={styles.tagline}>How well do you know each other?</Text>
                    <Text style={styles.label}>WE MATCHED ON</Text>
                    <Text style={styles.score}>{scorePercent}%</Text>
                </View>

                <View style={styles.branding}>
                    <Image source={logo} style={styles.brandingLogo} />
                    <Text style={styles.brandingText}>sauci.app</Text>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        aspectRatio: 0.7,
        borderRadius: radius.xl,
        overflow: "hidden",
    },
    gradient: {
        flex: 1,
        padding: spacing.lg,
        justifyContent: "space-between",
    },
    overlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "rgba(0, 0, 0, 0.08)",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    tagline: {
        ...typography.subhead,
        color: "rgba(255, 255, 255, 0.85)",
        textAlign: "center",
        marginBottom: spacing.xl,
    },
    label: {
        ...typography.caption1,
        fontWeight: "600",
        letterSpacing: 3,
        color: "rgba(255, 255, 255, 0.85)",
        marginBottom: spacing.xs,
    },
    score: {
        ...typography.largeTitle,
        fontSize: 64,
        lineHeight: 72,
        fontWeight: "800",
        color: "#ffffff",
    },
    branding: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    brandingLogo: {
        width: 24,
        height: 24,
        resizeMode: "contain",
    },
    brandingText: {
        ...typography.subhead,
        color: "#ffffff",
        fontWeight: "600",
    },
});
