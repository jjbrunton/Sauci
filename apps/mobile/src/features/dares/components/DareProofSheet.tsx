import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecorder } from "../../../hooks/useAudioRecorder";
import { uploadMedia } from "../../../lib/mediaApi";
import { colors, featureColors, radius, spacing, typography } from "../../../theme";
import type { SentDare } from "../types";

const ACCENT = featureColors.dares.accent;

const MAX_AUDIO_SECONDS = 60;

export interface DareProofSheetProps {
    /** The active incoming dare being submitted; null closes the sheet. */
    dare: SentDare | null;
    onClose: () => void;
    /** Uploads have already happened; the id is ready to attach to the submit call. */
    onSubmit: (dareId: string, proofMediaId: string) => Promise<void> | void;
}

function imageMime(uri: string): string {
    const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
}

/** expo-audio records .m4a on both platforms; web lands on webm. */
function audioMime(uri: string): string {
    const ext = uri.split(".").pop()?.toLowerCase() ?? "m4a";
    if (ext === "webm") return "audio/webm";
    if (ext === "wav") return "audio/wav";
    if (ext === "mp3") return "audio/mpeg";
    if (ext === "caf") return "audio/x-caf";
    return "audio/mp4";
}

export function DareProofSheet({ dare, onClose, onSubmit }: DareProofSheetProps) {
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recorder = useAudioRecorder({ maxDurationSeconds: MAX_AUDIO_SECONDS });
    const visible = dare !== null;
    const mode = dare?.proof_type ?? "none";

    useEffect(() => {
        if (!visible) return;
        setPhotoUri(null);
        setError(null);
        setSending(false);
        recorder.resetRecording();
        // Reset only when a new dare opens the sheet, not on recorder identity churn.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, dare?.id]);

    const pickPhoto = useCallback(async (fromCamera: boolean) => {
        setError(null);
        if (fromCamera) {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                setError("Camera access is needed to take a proof photo.");
                return;
            }
        }
        const result = fromCamera
            ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7 })
            : await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: false,
                  quality: 0.7,
              });
        if (!result.canceled) setPhotoUri(result.assets[0].uri);
    }, []);

    const proofUri = mode === "photo" ? photoUri : recorder.recordingUri;
    const canSend = proofUri !== null && !sending && recorder.state !== "recording";

    const handleSend = useCallback(async () => {
        if (!dare || !proofUri) return;
        setSending(true);
        setError(null);
        try {
            const mimeType = mode === "photo" ? imageMime(proofUri) : audioMime(proofUri);
            const upload = await uploadMedia(proofUri, { kind: "dare_proof", mimeType });
            await onSubmit(dare.id, upload.media.id);
            onClose();
        } catch {
            setError("Could not send your proof. Check your connection and try again.");
        } finally {
            setSending(false);
        }
    }, [dare, proofUri, mode, onSubmit, onClose]);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {mode === "photo" ? "Photo proof" : "Audio proof"}
                        </Text>
                        <Pressable onPress={onClose} hitSlop={12} disabled={sending}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <Text style={styles.subtitle}>
                        {mode === "photo"
                            ? "Your partner asked for a photo to prove this one."
                            : "Your partner asked for a voice note to prove this one."}
                    </Text>

                    {mode === "photo" ? (
                        <View style={styles.captureArea}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
                            ) : (
                                <View style={styles.placeholder}>
                                    <Ionicons name="camera-outline" size={32} color={colors.textTertiary} />
                                </View>
                            )}
                            <View style={styles.captureButtons}>
                                {Platform.OS !== "web" ? (
                                    <Pressable style={styles.captureButton} onPress={() => void pickPhoto(true)}>
                                        <Ionicons name="camera" size={16} color={ACCENT} />
                                        <Text style={styles.captureButtonText}>Take photo</Text>
                                    </Pressable>
                                ) : null}
                                <Pressable style={styles.captureButton} onPress={() => void pickPhoto(false)}>
                                    <Ionicons name="images-outline" size={16} color={ACCENT} />
                                    <Text style={styles.captureButtonText}>
                                        {photoUri ? "Choose another" : "Choose photo"}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.captureArea}>
                            <Pressable
                                style={[styles.recordButton, recorder.state === "recording" && styles.recordButtonActive]}
                                onPress={() => {
                                    if (recorder.state === "recording") void recorder.stopRecording();
                                    else void recorder.startRecording();
                                }}
                                disabled={sending}
                            >
                                <Ionicons
                                    name={recorder.state === "recording" ? "stop" : "mic"}
                                    size={28}
                                    color={recorder.state === "recording" ? colors.background : ACCENT}
                                />
                            </Pressable>
                            <Text style={styles.recordStatus}>
                                {recorder.state === "recording"
                                    ? `Recording… ${recorder.durationSeconds}s`
                                    : recorder.recordingUri
                                      ? `Recorded ${recorder.durationSeconds}s — tap the mic to redo`
                                      : `Tap to record (up to ${MAX_AUDIO_SECONDS}s)`}
                            </Text>
                        </View>
                    )}

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <Pressable
                        onPress={() => void handleSend()}
                        disabled={!canSend}
                        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color={colors.background} />
                        ) : (
                            <Text style={styles.sendButtonText}>Send proof & finish dare</Text>
                        )}
                    </Pressable>
                </View>
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
    subtitle: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.lg },
    captureArea: { alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
    preview: {
        width: "100%", height: 220,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    },
    placeholder: {
        width: "100%", height: 220,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.backgroundLight,
        alignItems: "center", justifyContent: "center",
    },
    captureButtons: { flexDirection: "row", gap: spacing.sm },
    captureButton: {
        flexDirection: "row", alignItems: "center", gap: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radius.full, borderWidth: 1, borderColor: ACCENT,
    },
    captureButtonText: { ...typography.subhead, color: ACCENT, fontWeight: "600" },
    recordButton: {
        width: 72, height: 72, borderRadius: radius.full,
        borderWidth: 2, borderColor: ACCENT,
        alignItems: "center", justifyContent: "center",
        backgroundColor: colors.backgroundLight,
    },
    recordButtonActive: { backgroundColor: ACCENT },
    recordStatus: { ...typography.footnote, color: colors.textSecondary },
    error: { ...typography.footnote, color: colors.error, marginBottom: spacing.md },
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
