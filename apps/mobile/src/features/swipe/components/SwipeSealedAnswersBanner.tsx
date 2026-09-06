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
            accessibilityLabel={`Invite your partner to compare ${sealedCount} sealed answers`}
        >
            <Ionicons name="lock-closed" size={16} color={colors.premium.rose} />
            <View style={styles.copy}>
                <Text style={styles.title}>{sealedCount} answer{sealedCount === 1 ? "" : "s"} sealed for your partner</Text>
                <Text style={styles.text}>When you both answer, your shared discoveries are ready to compare.</Text>
            </View>
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
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    copy: { flex: 1, gap: 2 },
    title: { ...typography.subhead, color: colors.text, fontWeight: "700" },
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
