import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { getMediaUrl } from "../../../lib/mediaApi";
import { colors, featureColors, radius, spacing, typography } from "../../../theme";
import type { DareProofType } from "../types";

const ACCENT = featureColors.dares.accent;

export interface DareProofViewProps {
    proofMediaId: string;
    proofType: DareProofType;
}

/**
 * Renders the attached proof inline on a dare card: the photo itself, or a
 * play button for audio. Signed URLs are short-lived, so the URL is resolved
 * lazily on first render (photo) or first play (audio).
 */
export function DareProofView({ proofMediaId, proofType }: DareProofViewProps) {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [sound, setSound] = useState<AudioPlayer | null>(null);
    const [playing, setPlaying] = useState(false);
    const [loadingAudio, setLoadingAudio] = useState(false);

    useEffect(() => {
        if (proofType !== "photo") return;
        let cancelled = false;
        getMediaUrl(proofMediaId)
            .then((result) => { if (!cancelled) setUrl(result.url); })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [proofMediaId, proofType]);

    useEffect(() => {
        return () => { if (sound) sound.remove(); };
    }, [sound]);

    const togglePlayback = useCallback(async () => {
        try {
            if (sound) {
                if (sound.playing) {
                    sound.pause();
                    setPlaying(false);
                } else {
                    await sound.seekTo(0);
                    sound.play();
                    setPlaying(true);
                }
                return;
            }
            setLoadingAudio(true);
            const { url: signedUrl } = await getMediaUrl(proofMediaId);
            const created = createAudioPlayer({ uri: signedUrl });
            created.addListener('playbackStatusUpdate', (status) => {
                if (status.didJustFinish) setPlaying(false);
            });
            created.play();
            setSound(created);
            setPlaying(true);
        } catch {
            setFailed(true);
        } finally {
            setLoadingAudio(false);
        }
    }, [sound, proofMediaId]);

    if (failed) {
        return <Text style={styles.failed}>Proof could not be loaded.</Text>;
    }

    if (proofType === "photo") {
        return url ? (
            <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
        ) : (
            <ActivityIndicator size="small" color={ACCENT} style={styles.loader} />
        );
    }

    return (
        <Pressable style={styles.audioRow} onPress={() => void togglePlayback()} disabled={loadingAudio}>
            {loadingAudio ? (
                <ActivityIndicator size="small" color={ACCENT} />
            ) : (
                <Ionicons name={playing ? "pause-circle" : "play-circle"} size={28} color={ACCENT} />
            )}
            <Text style={styles.audioLabel}>{playing ? "Playing proof…" : "Play audio proof"}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    photo: {
        width: "100%", height: 180, marginTop: spacing.sm,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    },
    loader: { marginTop: spacing.sm, alignSelf: "flex-start" },
    audioRow: {
        flexDirection: "row", alignItems: "center", gap: spacing.sm,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.background,
        alignSelf: "flex-start",
    },
    audioLabel: { ...typography.subhead, color: colors.text, fontWeight: "600" },
    failed: { ...typography.footnote, color: colors.textTertiary, marginTop: spacing.sm },
});
