import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import Animated, { FadeIn } from "react-native-reanimated";
import { GradientBackground } from "../../components/ui";
import { Paywall } from "../../components/paywall";
import { colors, featureColors, radius, spacing, typography } from "../../theme";
import { DareCard, DarePackGrid, SendDareSheet } from "./components";
import { useDares } from "./hooks/useDares";
import type { DarePack } from "./types";

const ACCENT = featureColors.dares.accent;

type Tab = "active" | "send" | "history";

const TABS: { key: Tab; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "send", label: "Send" },
    { key: "history", label: "History" },
];

export function DaresScreen() {
    const isFocused = useIsFocused();
    const dares = useDares({ isFocused });
    const [tab, setTab] = useState<Tab>("active");
    const [sheetPack, setSheetPack] = useState<DarePack | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [paywallOpen, setPaywallOpen] = useState(false);

    const openPaywall = useCallback(() => {
        setSheetOpen(false);
        setPaywallOpen(true);
    }, []);

    const closePaywall = useCallback(() => {
        setPaywallOpen(false);
        dares.clearPaywall();
    }, [dares]);

    const entitlement = dares.catalog?.entitlement ?? null;
    const premium = entitlement?.is_premium ?? false;

    const handleSelectPack = useCallback(
        (pack: DarePack) => {
            if (pack.is_premium && !premium) {
                openPaywall();
                return;
            }
            setSheetPack(pack);
            setSheetOpen(true);
        },
        [premium, openPaywall],
    );

    const handleWriteCustom = useCallback(() => {
        if (!premium) {
            openPaywall();
            return;
        }
        setSheetPack(null);
        setSheetOpen(true);
    }, [premium, openPaywall]);

    const handleAction = useCallback(
        (dareId: string, action: "accept" | "decline" | "submit" | "complete" | "cancel") => {
            if (action === "accept" || action === "decline") {
                void dares.respond(dareId, action);
                return;
            }
            void dares[action](dareId);
        },
        [dares],
    );

    // A premium refusal from the API opens the paywall even when the client thought
    // the action was allowed (stale entitlement, or a plan that lapsed mid-session).
    const { paywallReason } = dares;
    useEffect(() => {
        if (paywallReason) setPaywallOpen(true);
    }, [paywallReason]);

    const list = tab === "history" ? dares.history : dares.active;

    return (
        <GradientBackground>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl refreshing={false} onRefresh={() => void dares.refresh()} tintColor={ACCENT} />
                }
            >
                <Text style={styles.label}>ADVENTURE</Text>
                <Text style={styles.title}>Dares</Text>

                {dares.stats ? (
                    <View style={styles.statsRow}>
                        <Stat value={dares.stats.completed_together} label="Completed" />
                        <Stat value={dares.stats.active} label="In play" />
                        <Stat value={dares.stats.sent} label="You sent" />
                    </View>
                ) : null}

                {!premium && entitlement?.sends_remaining !== null && entitlement !== null ? (
                    <Pressable style={styles.quotaBanner} onPress={openPaywall}>
                        <Ionicons name="flash-outline" size={14} color={ACCENT} />
                        <Text style={styles.quotaText}>
                            {entitlement.sends_remaining} of {entitlement.weekly_send_limit} free dares left this week
                        </Text>
                        <Text style={styles.quotaCta}>Upgrade</Text>
                    </Pressable>
                ) : null}

                <View style={styles.tabs}>
                    {TABS.map(({ key, label }) => (
                        <Pressable
                            key={key}
                            onPress={() => setTab(key)}
                            style={[styles.tab, tab === key && styles.tabActive]}
                        >
                            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
                        </Pressable>
                    ))}
                </View>

                {dares.error ? <Text style={styles.error}>{dares.error}</Text> : null}

                {dares.loading ? (
                    <ActivityIndicator color={ACCENT} style={styles.loader} />
                ) : tab === "send" ? (
                    <DarePackGrid
                        packs={dares.catalog?.packs ?? []}
                        entitlement={entitlement}
                        onSelectPack={handleSelectPack}
                        onWriteCustom={handleWriteCustom}
                    />
                ) : list.length === 0 ? (
                    <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
                        <Ionicons name="sparkles-outline" size={28} color={ACCENT} />
                        <Text style={styles.emptyTitle}>
                            {tab === "active" ? "No dares in play" : "Nothing here yet"}
                        </Text>
                        <Text style={styles.emptyBody}>
                            {tab === "active"
                                ? "Send your partner a dare and see what happens."
                                : "Completed and declined dares will show up here."}
                        </Text>
                        {tab === "active" ? (
                            <Pressable style={styles.emptyButton} onPress={() => setTab("send")}>
                                <Text style={styles.emptyButtonText}>Browse dares</Text>
                            </Pressable>
                        ) : null}
                    </Animated.View>
                ) : (
                    list.map((dare) => (
                        <DareCard
                            key={dare.id}
                            dare={dare}
                            busy={dares.busyDareId === dare.id}
                            onAction={handleAction}
                        />
                    ))
                )}
            </ScrollView>

            <SendDareSheet
                visible={sheetOpen}
                pack={sheetPack}
                canSendCustom={entitlement?.can_send_custom ?? false}
                onClose={() => setSheetOpen(false)}
                onSend={dares.send}
                onRequestPremium={openPaywall}
            />

            <Paywall
                visible={paywallOpen}
                onClose={closePaywall}
                onSuccess={() => {
                    closePaywall();
                    void dares.refresh();
                }}
            />
        </GradientBackground>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    container: { paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: 120 },
    label: {
        ...typography.caption1, fontWeight: "600", letterSpacing: 3,
        color: ACCENT, marginBottom: spacing.xs,
    },
    title: { ...typography.largeTitle, color: colors.text, marginBottom: spacing.lg },
    statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    stat: {
        flex: 1, alignItems: "center",
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        paddingVertical: spacing.md,
    },
    statValue: { ...typography.title2, color: ACCENT },
    statLabel: { ...typography.caption2, color: colors.textSecondary, marginTop: 2 },
    quotaBanner: {
        flexDirection: "row", alignItems: "center", gap: spacing.sm,
        backgroundColor: "rgba(212,175,55,0.08)",
        borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(212,175,55,0.3)",
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        marginBottom: spacing.md,
    },
    quotaText: { ...typography.caption1, color: colors.textSecondary, flex: 1 },
    quotaCta: { ...typography.caption1, color: ACCENT, fontWeight: "700" },
    tabs: {
        flexDirection: "row",
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.full,
        padding: 3,
        marginBottom: spacing.lg,
    },
    tab: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.full },
    tabActive: { backgroundColor: ACCENT },
    tabText: { ...typography.subhead, color: colors.textSecondary, fontWeight: "600" },
    tabTextActive: { color: colors.background },
    loader: { marginTop: spacing.xl },
    error: { ...typography.footnote, color: colors.error, marginBottom: spacing.md },
    empty: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyTitle: { ...typography.headline, color: colors.text, marginTop: spacing.sm },
    emptyBody: {
        ...typography.subhead, color: colors.textSecondary,
        textAlign: "center", paddingHorizontal: spacing.lg,
    },
    emptyButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
        borderRadius: radius.full, borderWidth: 1, borderColor: ACCENT,
    },
    emptyButtonText: { ...typography.subhead, color: ACCENT, fontWeight: "600" },
});

export default DaresScreen;
