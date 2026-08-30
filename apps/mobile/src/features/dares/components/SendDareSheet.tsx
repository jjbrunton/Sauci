import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
    ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { daresApi } from "../../../lib/daresApi";
import { colors, featureColors, radius, spacing, typography } from "../../../theme";
import { DURATION_OPTIONS, PROOF_OPTIONS, type DareItem, type DarePack, type DareProofType, type SendDarePayload } from "../types";

const ACCENT = featureColors.dares.accent;

export interface SendDareSheetProps {
    visible: boolean;
    pack: DarePack | null;
    /** Null while the catalogue is loading; drives the custom-dare affordance. */
    canSendCustom: boolean;
    onClose: () => void;
    onSend: (payload: SendDarePayload) => Promise<boolean>;
    onRequestPremium: () => void;
}

export function SendDareSheet({ visible, pack, canSendCustom, onClose, onSend, onRequestPremium }: SendDareSheetProps) {
    const [dares, setDares] = useState<DareItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [customText, setCustomText] = useState("");
    const [durationHours, setDurationHours] = useState<number | null>(24);
    const [proofType, setProofType] = useState<DareProofType>("none");
    const [notes, setNotes] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!visible || !pack) return;
        setLoading(true);
        setSelectedId(null);
        setCustomText("");
        setNotes("");
        setProofType("none");
        daresApi
            .packDares(pack.id)
            .then((result) => setDares(result.dares))
            .catch(() => setDares([]))
            .finally(() => setLoading(false));
    }, [visible, pack]);

    const isCustom = pack === null;
    const canSubmit = isCustom ? customText.trim().length > 0 : selectedId !== null;

    const handleSend = useCallback(async () => {
        if (!canSubmit || sending) return;
        setSending(true);
        const payload: SendDarePayload = isCustom
            ? { custom_dare_text: customText.trim(), custom_dare_intensity: 3, duration_hours: durationHours }
            : { dare_id: selectedId!, duration_hours: durationHours };
        if (notes.trim()) payload.sender_notes = notes.trim();
        if (proofType !== "none") payload.proof_type = proofType;
        const sent = await onSend(payload);
        setSending(false);
        if (sent) onClose();
    }, [canSubmit, sending, isCustom, customText, selectedId, durationHours, proofType, notes, onSend, onClose]);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.sheet}
                >
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Text style={styles.title}>{isCustom ? "Write a dare" : pack?.name}</Text>
                        <Pressable onPress={onClose} hitSlop={12}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
                        {isCustom ? (
                            canSendCustom ? (
                                <TextInput
                                    style={styles.customInput}
                                    value={customText}
                                    onChangeText={setCustomText}
                                    placeholder="Dare your partner to..."
                                    placeholderTextColor={colors.textTertiary}
                                    multiline
                                    maxLength={500}
                                />
                            ) : (
                                <Pressable style={styles.lockedCard} onPress={onRequestPremium}>
                                    <Ionicons name="lock-closed" size={18} color={ACCENT} />
                                    <Text style={styles.lockedText}>Custom dares are a premium feature</Text>
                                </Pressable>
                            )
                        ) : loading ? (
                            <ActivityIndicator color={ACCENT} style={styles.loader} />
                        ) : (
                            dares.map((dare) => {
                                const selected = dare.id === selectedId;
                                return (
                                    <Pressable
                                        key={dare.id}
                                        onPress={() => setSelectedId(dare.id)}
                                        style={[styles.option, selected && styles.optionSelected]}
                                    >
                                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                                            {dare.text}
                                        </Text>
                                        <View style={styles.intensityRow}>
                                            {Array.from({ length: 5 }, (_, index) => (
                                                <View
                                                    key={index}
                                                    style={[styles.pip, index < dare.intensity && styles.pipFilled]}
                                                />
                                            ))}
                                        </View>
                                    </Pressable>
                                );
                            })
                        )}

                        <Text style={styles.sectionLabel}>TIME LIMIT</Text>
                        <View style={styles.durationRow}>
                            {DURATION_OPTIONS.map((option) => {
                                const selected = option.hours === durationHours;
                                return (
                                    <Pressable
                                        key={option.label}
                                        onPress={() => setDurationHours(option.hours)}
                                        style={[styles.chip, selected && styles.chipSelected]}
                                    >
                                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.sectionLabel}>REQUIRE PROOF</Text>
                        <View style={styles.durationRow}>
                            {PROOF_OPTIONS.map((option) => {
                                const selected = option.value === proofType;
                                return (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => setProofType(option.value)}
                                        style={[styles.chip, styles.proofChip, selected && styles.chipSelected]}
                                    >
                                        <Ionicons
                                            name={option.icon as keyof typeof Ionicons.glyphMap}
                                            size={14}
                                            color={selected ? ACCENT : colors.textSecondary}
                                        />
                                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.sectionLabel}>ADD A NOTE</Text>
                        <TextInput
                            style={styles.notesInput}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Optional"
                            placeholderTextColor={colors.textTertiary}
                            maxLength={500}
                        />
                    </ScrollView>

                    <Pressable
                        onPress={handleSend}
                        disabled={!canSubmit || sending}
                        style={[styles.sendButton, (!canSubmit || sending) && styles.sendButtonDisabled]}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color={colors.background} />
                        ) : (
                            <Text style={styles.sendButtonText}>Send dare</Text>
                        )}
                    </Pressable>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    sheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        paddingHorizontal: spacing.lg,
        paddingBottom: Platform.OS === "ios" ? spacing.xl : spacing.lg,
        maxHeight: "88%",
    },
    handle: {
        width: 36, height: 4, borderRadius: radius.full,
        backgroundColor: colors.border, alignSelf: "center", marginTop: spacing.sm,
    },
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingVertical: spacing.md,
    },
    title: { ...typography.title3, color: colors.text },
    body: { marginBottom: spacing.md },
    loader: { marginVertical: spacing.xl },
    option: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    optionSelected: { borderColor: ACCENT, backgroundColor: "rgba(212,175,55,0.08)" },
    optionText: { ...typography.subhead, color: colors.textSecondary },
    optionTextSelected: { color: colors.text },
    intensityRow: { flexDirection: "row", gap: 3, marginTop: spacing.sm },
    pip: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: colors.border },
    pipFilled: { backgroundColor: ACCENT },
    customInput: {
        ...typography.body,
        color: colors.text,
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        minHeight: 100,
        textAlignVertical: "top",
    },
    lockedCard: {
        flexDirection: "row", alignItems: "center", gap: spacing.sm,
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md, borderWidth: 1, borderColor: ACCENT,
        padding: spacing.md,
    },
    lockedText: { ...typography.subhead, color: ACCENT, fontWeight: "600" },
    sectionLabel: {
        ...typography.caption2,
        color: colors.textTertiary,
        letterSpacing: 2,
        fontWeight: "600",
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    durationRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2,
        borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    },
    proofChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    chipSelected: { borderColor: ACCENT, backgroundColor: "rgba(212,175,55,0.12)" },
    chipText: { ...typography.footnote, color: colors.textSecondary },
    chipTextSelected: { color: ACCENT, fontWeight: "600" },
    notesInput: {
        ...typography.subhead,
        color: colors.text,
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
    },
    sendButton: {
        backgroundColor: ACCENT,
        borderRadius: radius.full,
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 50,
    },
    sendButtonDisabled: { opacity: 0.4 },
    sendButtonText: { ...typography.headline, color: colors.background, fontWeight: "700" },
});
