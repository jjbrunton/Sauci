import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, featureColors, radius, spacing, typography } from "../../../theme";
import type { SentDare } from "../types";

const ACCENT = featureColors.dares.accent;

/** The one action each side owns at each step of the loop. */
type Action = "accept" | "decline" | "submit" | "complete" | "cancel";

export interface DareCardProps {
    dare: SentDare;
    busy: boolean;
    onAction: (dareId: string, action: Action) => void;
}

function relativeDeadline(expiresAt: string | null): string | null {
    if (!expiresAt) return null;
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) return "Time's up";
    const hours = Math.floor(remainingMs / 3_600_000);
    if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
    if (hours >= 1) return `${hours}h left`;
    return `${Math.max(1, Math.round(remainingMs / 60_000))}m left`;
}

function statusLabel(dare: SentDare): string {
    const them = dare.direction === "incoming" ? "They dared you" : "You dared them";
    switch (dare.status) {
        case "pending": return dare.direction === "incoming" ? "Waiting on you" : "Waiting on them";
        case "active": return dare.direction === "incoming" ? "Your turn" : "They accepted";
        case "submitted": return dare.direction === "incoming" ? "Waiting to be confirmed" : "They say it's done";
        case "completed": return "Completed";
        case "declined": return "Declined";
        case "cancelled": return "Cancelled";
        case "expired": return "Expired";
        default: return them;
    }
}

/** Only surfaces buttons the viewer is actually allowed to press. */
function actionsFor(dare: SentDare): { action: Action; label: string; primary?: boolean }[] {
    if (dare.direction === "incoming") {
        if (dare.status === "pending") {
            return [
                { action: "accept", label: "Accept", primary: true },
                { action: "decline", label: "Pass" },
            ];
        }
        if (dare.status === "active") return [{ action: "submit", label: "I did it", primary: true }];
        return [];
    }
    if (dare.status === "submitted") {
        return [
            { action: "complete", label: "Confirm", primary: true },
            { action: "cancel", label: "Cancel" },
        ];
    }
    if (dare.status === "pending" || dare.status === "active") {
        return [{ action: "cancel", label: "Cancel" }];
    }
    return [];
}

export const DareCard = memo(function DareCard({ dare, busy, onAction }: DareCardProps) {
    const deadline = relativeDeadline(dare.expires_at);
    const actions = actionsFor(dare);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.directionRow}>
                    <Ionicons
                        name={dare.direction === "incoming" ? "arrow-down-circle" : "arrow-up-circle"}
                        size={16}
                        color={ACCENT}
                    />
                    <Text style={styles.status}>{statusLabel(dare)}</Text>
                </View>
                <View style={styles.intensityRow}>
                    {Array.from({ length: 5 }, (_, index) => (
                        <View
                            key={index}
                            style={[styles.pip, index < dare.intensity && styles.pipFilled]}
                        />
                    ))}
                </View>
            </View>

            <Text style={styles.text}>{dare.text}</Text>

            {dare.sender_notes ? <Text style={styles.notes}>“{dare.sender_notes}”</Text> : null}

            {deadline ? (
                <View style={styles.deadlineRow}>
                    <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                    <Text style={styles.deadline}>{deadline}</Text>
                </View>
            ) : null}

            {actions.length > 0 ? (
                <View style={styles.actions}>
                    {busy ? (
                        <ActivityIndicator size="small" color={ACCENT} />
                    ) : (
                        actions.map(({ action, label, primary }) => (
                            <Pressable
                                key={action}
                                onPress={() => onAction(dare.id, action)}
                                style={[styles.button, primary ? styles.buttonPrimary : styles.buttonSecondary]}
                            >
                                <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
                            </Pressable>
                        ))
                    )}
                </View>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.sm,
    },
    directionRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    status: {
        ...typography.caption1,
        color: ACCENT,
        fontWeight: "600",
        letterSpacing: 0.5,
    },
    intensityRow: { flexDirection: "row", gap: 3 },
    pip: {
        width: 5,
        height: 5,
        borderRadius: radius.full,
        backgroundColor: colors.border,
    },
    pipFilled: { backgroundColor: ACCENT },
    text: { ...typography.body, color: colors.text },
    notes: {
        ...typography.footnote,
        color: colors.textSecondary,
        fontStyle: "italic",
        marginTop: spacing.sm,
    },
    deadlineRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    deadline: { ...typography.caption1, color: colors.textTertiary },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.md,
        minHeight: 36,
    },
    button: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
    },
    buttonPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },
    buttonSecondary: { backgroundColor: "transparent", borderColor: colors.border },
    buttonText: { ...typography.subhead, fontWeight: "600", color: colors.textSecondary },
    buttonTextPrimary: { color: colors.background },
});
