import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, featureColors, radius, spacing, typography } from "../../../theme";
import type { DareEntitlement, DarePack } from "../types";

const ACCENT = featureColors.dares.accent;

export interface DarePackGridProps {
    packs: DarePack[];
    entitlement: DareEntitlement | null;
    onSelectPack: (pack: DarePack) => void;
    onWriteCustom: () => void;
}

export function DarePackGrid({ packs, entitlement, onSelectPack, onWriteCustom }: DarePackGridProps) {
    const premium = entitlement?.is_premium ?? false;

    return (
        <View>
            <Pressable style={styles.customRow} onPress={onWriteCustom}>
                <View style={styles.customIcon}>
                    <Ionicons name={premium ? "create-outline" : "lock-closed"} size={18} color={ACCENT} />
                </View>
                <View style={styles.customCopy}>
                    <Text style={styles.customTitle}>Write your own</Text>
                    <Text style={styles.customSubtitle}>
                        {premium ? "Make it personal" : "Premium"}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>

            {packs.map((pack) => {
                const locked = pack.is_premium && !premium;
                return (
                    <Pressable key={pack.id} style={styles.packRow} onPress={() => onSelectPack(pack)}>
                        <Text style={styles.packIcon}>{pack.icon ?? "🔥"}</Text>
                        <View style={styles.packCopy}>
                            <View style={styles.packTitleRow}>
                                <Text style={styles.packTitle}>{pack.name}</Text>
                                {locked ? <Ionicons name="lock-closed" size={13} color={ACCENT} /> : null}
                            </View>
                            <Text style={styles.packSubtitle} numberOfLines={1}>
                                {pack.description ?? `${pack.dare_count} dares`}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </Pressable>
                );
            })}
        </View>
    );
}

const row = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.backgroundLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
};

const styles = StyleSheet.create({
    customRow: { ...row, borderColor: "rgba(212,175,55,0.35)" },
    customIcon: {
        width: 36, height: 36, borderRadius: radius.full,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(212,175,55,0.12)",
    },
    customCopy: { flex: 1 },
    customTitle: { ...typography.headline, color: colors.text },
    customSubtitle: { ...typography.caption1, color: ACCENT, marginTop: 2 },
    packRow: row,
    packIcon: { fontSize: 26, width: 36, textAlign: "center" },
    packCopy: { flex: 1 },
    packTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    packTitle: { ...typography.headline, color: colors.text },
    packSubtitle: { ...typography.caption1, color: colors.textSecondary, marginTop: 2 },
});
