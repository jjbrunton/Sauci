import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../../../theme";

interface SwipeSealedAnswersBannerProps {
    sealedCount: number;
    onInvitePress: () => void;
}

/**
 * An unpaired user answers straight into the swipe flow now instead of hitting a
 * dead-end waiting room. This banner keeps the invite ask visible without blocking
 * play, and grows more concrete as the sealed count climbs.
 */
export const SwipeSealedAnswersBanner = ({ sealedCount, onInvitePress }: SwipeSealedAnswersBannerProps) => {
    if (sealedCount <= 0) return null;

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onInvitePress}
            activeOpacity={0.8}
            testID="swipe-sealed-answers-banner"
        >
            <Ionicons name="lock-closed" size={16} color={colors.premium.rose} />
            <Text style={styles.text}>
                {sealedCount} answer{sealedCount === 1 ? "" : "s"} sealed. Your partner unlocks {sealedCount === 1 ? "it" : "them"} when they join.
            </Text>
            <Text style={styles.cta}>Invite</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: colors.backgroundLight,
    },
    text: {
        ...typography.caption1,
        color: colors.textSecondary,
        flex: 1,
    },
    cta: {
        ...typography.caption1,
        color: colors.premium.rose,
        fontWeight: "700",
    },
});
