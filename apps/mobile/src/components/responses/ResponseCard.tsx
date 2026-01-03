import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInRight } from "react-native-reanimated";
import type { ResponseWithQuestion } from "../../store";
import { colors, spacing, typography, radius } from "../../theme";

// Premium color palette
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = "rgba(212, 175, 55, ";
const ROSE = colors.premium.rose;
const ROSE_RGBA = "rgba(232, 164, 174, ";

// Answer colors (semantic)
const ANSWER_COLORS = {
    yes: {
        color: colors.success,
        rgba: "rgba(46, 204, 113, ",
        label: "YES",
    },
    no: {
        color: colors.error,
        rgba: "rgba(231, 76, 60, ",
        label: "NO",
    },
    maybe: {
        color: colors.warning,
        rgba: "rgba(243, 156, 18, ",
        label: "MAYBE",
    },
};

interface ResponseCardProps {
    response: ResponseWithQuestion;
    index: number;
    onEditPress: () => void;
    onChatPress?: () => void;
}

export function ResponseCard({ response, index, onEditPress, onChatPress }: ResponseCardProps) {
    const answerStyle = ANSWER_COLORS[response.answer];

    return (
        <Animated.View entering={FadeInRight.delay(index * 30).duration(250)}>
            <View style={styles.card}>
                {/* Subtle gradient background */}
                <LinearGradient
                    colors={["rgba(22, 33, 62, 0.6)", "rgba(13, 13, 26, 0.8)"]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                {/* Top silk highlight */}
                <LinearGradient
                    colors={[`${answerStyle.rgba}0.06)`, "transparent"]}
                    style={styles.cardSilkHighlight}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />

                <View style={styles.row}>
                    {/* Answer badge */}
                    <View
                        style={[
                            styles.answerBadge,
                            { backgroundColor: `${answerStyle.rgba}0.15)`, borderColor: `${answerStyle.rgba}0.3)` },
                        ]}
                    >
                        <Ionicons
                            name={
                                response.answer === "yes"
                                    ? "checkmark"
                                    : response.answer === "no"
                                      ? "close"
                                      : "help"
                            }
                            size={18}
                            color={answerStyle.color}
                        />
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={styles.questionText} numberOfLines={2}>
                            {response.question.text}
                        </Text>

                        <View style={styles.metaRow}>
                            {/* Answer tag */}
                            <View
                                style={[
                                    styles.tag,
                                    {
                                        backgroundColor: `${answerStyle.rgba}0.1)`,
                                        borderColor: `${answerStyle.rgba}0.2)`,
                                    },
                                ]}
                            >
                                <Text style={[styles.tagText, { color: answerStyle.color }]}>
                                    {answerStyle.label}
                                </Text>
                            </View>

                            {/* Pack name */}
                            <View style={styles.packBadge}>
                                <Ionicons name="layers-outline" size={10} color={colors.textTertiary} />
                                <Text style={styles.packText} numberOfLines={1}>
                                    {response.question.pack.name}
                                </Text>
                            </View>

                            {/* Partner status indicator */}
                            {response.partner_answered && (
                                <View style={styles.partnerBadge}>
                                    <Ionicons name="person" size={10} color={colors.textTertiary} />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Right section */}
                    <View style={styles.rightSection}>
                        {/* Match indicator with chat link */}
                        {response.has_match && onChatPress && (
                            <TouchableOpacity style={styles.matchButton} onPress={onChatPress}>
                                <Ionicons name="heart" size={14} color={colors.primary} />
                            </TouchableOpacity>
                        )}

                        {/* Edit button */}
                        <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
                            <Ionicons name="pencil" size={14} color={ACCENT} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Premium border */}
                <View style={styles.cardBorder} pointerEvents="none" />
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginBottom: spacing.sm,
        borderRadius: radius.lg,
        overflow: "hidden",
        padding: spacing.md,
    },
    cardSilkHighlight: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 50,
    },
    cardBorder: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    answerBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        marginRight: spacing.md,
    },
    content: {
        flex: 1,
    },
    questionText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "500",
        marginBottom: spacing.xs,
        lineHeight: 20,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        flexWrap: "wrap",
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.sm,
        borderWidth: 1,
    },
    tagText: {
        ...typography.caption2,
        fontWeight: "700",
        letterSpacing: 1,
    },
    packBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        maxWidth: 120,
    },
    packText: {
        ...typography.caption2,
        color: colors.textTertiary,
    },
    partnerBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        justifyContent: "center",
        alignItems: "center",
    },
    rightSection: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginLeft: spacing.sm,
    },
    matchButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(233, 69, 96, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(233, 69, 96, 0.25)",
        justifyContent: "center",
        alignItems: "center",
    },
    editButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.2)`,
        justifyContent: "center",
        alignItems: "center",
    },
});
