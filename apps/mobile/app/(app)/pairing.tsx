import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Share,
    Linking,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { useAuthStore, useMatchStore } from "../../src/store";
import { coupleApi } from "../../src/lib/coupleApi";
import { getPairingError } from "../../src/lib/errors";
import { buildInviteShareMessage } from "../../src/lib/inviteShareCopy";
import { Events } from "../../src/lib/analytics";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground, GlassCard, GlassButton } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography, shadows } from "../../src/theme";
import { isValidInviteCode, normalizeInviteCode } from "../../src/lib/inviteLink";
import { getPendingInviteCode, clearPendingInviteCode } from "../../src/lib/pendingInviteCode";
import { checkClipboardForInviteCode } from "../../src/lib/clipboardInviteOffer";

export default function PairingScreen() {
    const { fetchCouple, fetchUser, couple, partner, sealedCount, isLoading: isAuthLoading } = useAuthStore();
    const params = useLocalSearchParams<{ code?: string }>();
    const [inviteCode, setInviteCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [wasPrefilled, setWasPrefilled] = useState(false);
    const [clipboardOfferCode, setClipboardOfferCode] = useState<string | null>(null);
    const [prefillAttempted, setPrefillAttempted] = useState(false);

    // Redirect if already paired. Pairing claims both members' sealed answers and
    // computes matches server-side, so the matches store must refetch here too:
    // whichever partner lands on this redirect first would otherwise show stale,
    // pre-pairing matches until some unrelated screen happened to refresh it.
    useEffect(() => {
        if (couple && partner) {
            void useMatchStore.getState().fetchMatches(true);
            router.replace("/(app)");
        }
    }, [couple, partner]);

    // One-time prefill: apply a code carried by a join link (route param), then
    // a stashed code from before sign-in, and only otherwise offer a clipboard
    // match. Never auto-submits; the user still taps "Join Partner".
    useEffect(() => {
        if (couple) return; // only relevant to the unpaired join flow
        if (prefillAttempted) return;

        let cancelled = false;

        const applyPrefill = async (code: string) => {
            if (cancelled) return;
            setInviteCode(code);
            setWasPrefilled(true);
            Events.pairingCodePrefilled();
        };

        (async () => {
            const routeCode = typeof params.code === "string" ? normalizeInviteCode(params.code) : "";
            if (isValidInviteCode(routeCode)) {
                await applyPrefill(routeCode);
                await clearPendingInviteCode();
                if (!cancelled) setPrefillAttempted(true);
                return;
            }

            const stashedCode = await getPendingInviteCode();
            if (stashedCode) {
                await applyPrefill(stashedCode);
                await clearPendingInviteCode();
                if (!cancelled) setPrefillAttempted(true);
                return;
            }

            const clipboardCode = await checkClipboardForInviteCode();
            if (clipboardCode && !cancelled) {
                setClipboardOfferCode(clipboardCode);
            }
            if (!cancelled) setPrefillAttempted(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [couple, params.code, prefillAttempted]);

    const acceptClipboardOffer = () => {
        if (!clipboardOfferCode) return;
        setInviteCode(clipboardOfferCode);
        setWasPrefilled(true);
        Events.inviteLinkOpened("clipboard");
        Events.pairingCodePrefilled();
        setClipboardOfferCode(null);
    };

    const dismissClipboardOffer = () => {
        setClipboardOfferCode(null);
    };

    // Poll the standalone API while waiting for a partner. Realtime delivery can
    // be added later without coupling product data back to Supabase.
    useEffect(() => {
        if (!couple || partner) return;

        // Poll every 5 seconds as fallback
        const pollInterval = setInterval(() => {
            fetchCouple();
        }, 5000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [couple, partner, fetchCouple]);

    const handleCreateCouple = async () => {
        setIsSubmitting(true);
        try {
            await coupleApi.create();

            await fetchUser(); // Refresh user to get couple_id
            await fetchCouple(); // Fetch couple data
            Events.coupleCreated();
        } catch (error: any) {
            Alert.alert("Error", getPairingError(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJoinCouple = async () => {
        // Validate invite code format (8 alphanumeric characters)
        const sanitizedCode = inviteCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(sanitizedCode)) {
            Alert.alert("Invalid Code", "Please enter a valid 8-character invite code.");
            return;
        }

        setIsSubmitting(true);
        try {
            await coupleApi.join(sanitizedCode);

            await fetchUser(); // Refresh user to get couple_id
            await fetchCouple(); // Fetch couple data
            // Joining claims both members' sealed answers and computes matches
            // server-side, so the joiner needs a fresh matches list too.
            void useMatchStore.getState().fetchMatches(true);
            Events.coupleJoined();

            Alert.alert("Success", "You are now paired!", [
                { text: "Let's Go", onPress: () => router.replace("/(app)") }
            ]);
        } catch (error: any) {
            Alert.alert("Error", getPairingError(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = async () => {
        if (couple?.invite_code) {
            await Clipboard.setStringAsync(couple.invite_code);
            Events.inviteCodeCopied();
            Alert.alert("Copied", "Invite code copied to clipboard");
        }
    };

    const handleInviteCodeChange = (value: string) => {
        setWasPrefilled(false);
        setInviteCode(value);
    };

    const shareMessage = couple?.invite_code
        ? buildInviteShareMessage(couple.invite_code, sealedCount)
        : "";

    const shareCode = async () => {
        if (couple?.invite_code) {
            try {
                await Share.share({ message: shareMessage });
                Events.codeShared();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const shareViaWhatsApp = async () => {
        const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
            Events.codeShared();
        } else {
            shareCode();
        }
    };

    const shareViaSMS = async () => {
        const url = `sms:&body=${encodeURIComponent(shareMessage)}`;
        await Linking.openURL(url);
        Events.codeShared();
    };

    const handleCancelPairing = async () => {
        Alert.alert(
            "Cancel Pairing",
            "Are you sure you want to cancel? Your invite code will be deleted.",
            [
                { text: "Keep Waiting", style: "cancel" },
                {
                    text: "Cancel Pairing",
                    style: "destructive",
                    onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            await coupleApi.cancel();

                            await fetchUser();
                            await fetchCouple();
                            Events.pairingCancelled();
                        } catch (error: any) {
                            Alert.alert("Error", getPairingError(error));
                        } finally {
                            setIsSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    if (isAuthLoading) {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    // If user has a couple but no partner, they are waiting
    if (couple && !partner) {
        return (
            <GradientBackground>
                <View style={styles.container}>
                    {/* Header */}
                    <Animated.View
                        entering={FadeInDown.delay(100).duration(500)}
                        style={styles.header}
                    >
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Partner Code</Text>
                    </Animated.View>

                    <View style={styles.content}>
                        {/* Icon */}
                        <Animated.View
                            entering={FadeInDown.delay(200).duration(500)}
                            style={styles.iconSection}
                        >
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.iconGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="heart" size={40} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.subtitle}>
                                Share this code with your partner to link your accounts
                            </Text>
                        </Animated.View>

                        {/* Earned value: sealed answers already banked while unpaired */}
                        {sealedCount > 0 && (
                            <Animated.View
                                entering={FadeInDown.delay(250).duration(500)}
                                style={styles.section}
                            >
                                <GlassCard variant="elevated">
                                    <Text style={styles.sealedCountText} testID="pairing-sealed-count">
                                        You have already answered {sealedCount} question{sealedCount === 1 ? "" : "s"} about us.
                                        They will unlock the moment your partner joins.
                                    </Text>
                                </GlassCard>
                            </Animated.View>
                        )}

                        {/* Code Card */}
                        <Animated.View
                            entering={FadeInDown.delay(300).duration(500)}
                            style={styles.section}
                        >
                            <GlassCard variant="elevated">
                                <TouchableOpacity
                                    style={styles.codeContainer}
                                    onPress={copyToClipboard}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.code}>{couple.invite_code.toUpperCase()}</Text>
                                    <View style={styles.copyIcon}>
                                        <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
                                    </View>
                                </TouchableOpacity>
                                <Text style={styles.tapToCopy}>Tap to copy</Text>
                            </GlassCard>
                        </Animated.View>

                        {/* CTA Text */}
                        <Animated.View
                            entering={FadeInDown.delay(350).duration(500)}
                            style={styles.ctaSection}
                        >
                            <Text style={styles.ctaText}>Send this to your partner to get started</Text>
                        </Animated.View>

                        {/* Primary Share Button */}
                        <Animated.View
                            entering={FadeInDown.delay(400).duration(500)}
                            style={styles.section}
                        >
                            <GlassButton
                                onPress={shareCode}
                                fullWidth
                                size="lg"
                                icon={<Ionicons name="share-outline" size={22} color={colors.text} />}
                            >
                                Share Invite Code
                            </GlassButton>
                        </Animated.View>

                        {/* Quick share buttons */}
                        <Animated.View
                            entering={FadeInDown.delay(450).duration(500)}
                            style={styles.quickShareRow}
                        >
                            <TouchableOpacity style={styles.quickShareButton} onPress={shareViaSMS} activeOpacity={0.7}>
                                <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                                <Text style={styles.quickShareLabel}>Messages</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickShareButton} onPress={shareViaWhatsApp} activeOpacity={0.7}>
                                <Ionicons name="logo-whatsapp" size={20} color={colors.text} />
                                <Text style={styles.quickShareLabel}>WhatsApp</Text>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Waiting indicator */}
                        <Animated.View
                            entering={FadeInDown.delay(500).duration(500)}
                            style={styles.waitingSection}
                        >
                            <View style={styles.waitingBadge}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.waitingText}>Waiting for your partner to join...</Text>
                            </View>
                        </Animated.View>

                        {/* Cancel Button */}
                        <Animated.View
                            entering={FadeInDown.delay(600).duration(500)}
                            style={styles.cancelSection}
                        >
                            <TouchableOpacity
                                onPress={handleCancelPairing}
                                disabled={isSubmitting}
                                style={styles.cancelButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>Cancel Pairing</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(500)}
                    style={styles.header}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Pair Up</Text>
                </Animated.View>

                <View style={styles.content}>
                    {/* Icon */}
                    <Animated.View
                        entering={FadeInDown.delay(200).duration(500)}
                        style={styles.iconSection}
                    >
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.iconGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="link" size={40} color={colors.text} />
                        </LinearGradient>
                        <Text style={styles.subtitle}>
                            Link with your partner to start matching
                        </Text>
                    </Animated.View>

                    {/* Clipboard invite code offer */}
                    {clipboardOfferCode && (
                        <Animated.View
                            entering={FadeInDown.duration(400)}
                            style={styles.section}
                        >
                            <View style={styles.clipboardOffer} testID="clipboard-invite-offer">
                                <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
                                <Text style={styles.clipboardOfferText}>
                                    Use code {clipboardOfferCode} from your clipboard?
                                </Text>
                                <View style={styles.clipboardOfferActions}>
                                    <TouchableOpacity
                                        onPress={dismissClipboardOffer}
                                        style={styles.clipboardOfferButton}
                                        testID="clipboard-invite-offer-dismiss"
                                    >
                                        <Text style={styles.clipboardOfferDismissText}>Not now</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={acceptClipboardOffer}
                                        style={[styles.clipboardOfferButton, styles.clipboardOfferButtonPrimary]}
                                        testID="clipboard-invite-offer-accept"
                                    >
                                        <Text style={styles.clipboardOfferAcceptText}>Use code</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>
                    )}

                    {/* Join Card */}
                    <Animated.View
                        entering={FadeInDown.delay(300).duration(500)}
                        style={styles.section}
                    >
                        <Text style={styles.sectionTitle}>Have a code?</Text>
                        <GlassCard>
                            <TextInput
                                style={[styles.input, wasPrefilled && styles.inputPrefilled]}
                                placeholder="Enter invite code"
                                placeholderTextColor={colors.textTertiary}
                                value={inviteCode}
                                onChangeText={handleInviteCodeChange}
                                autoCapitalize="characters"
                                maxLength={8}
                                testID="invite-code-input"
                            />
                            {wasPrefilled && (
                                <Text style={styles.prefilledCaption}>
                                    Code applied from your invite link
                                </Text>
                            )}
                            <GlassButton
                                onPress={handleJoinCouple}
                                disabled={isSubmitting}
                                loading={isSubmitting}
                                fullWidth
                            >
                                Join Partner
                            </GlassButton>
                        </GlassCard>
                    </Animated.View>

                    {/* Divider */}
                    <Animated.View
                        entering={FadeInDown.delay(400).duration(500)}
                        style={styles.divider}
                    >
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </Animated.View>

                    {/* Create Code Button */}
                    <Animated.View
                        entering={FadeInDown.delay(500).duration(500)}
                        style={styles.section}
                    >
                        <GlassButton
                            variant="secondary"
                            onPress={handleCreateCouple}
                            disabled={isSubmitting}
                            fullWidth
                        >
                            Create New Code
                        </GlassButton>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.backgroundLight,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    input: {
        backgroundColor: colors.background, // Flat background
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
        letterSpacing: 4,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        marginBottom: spacing.md,
    },
    inputPrefilled: {
        borderColor: colors.primary,
    },
    prefilledCaption: {
        ...typography.caption1,
        color: colors.primary,
        textAlign: "center",
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
    },
    clipboardOffer: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    clipboardOfferText: {
        ...typography.subhead,
        color: colors.text,
    },
    clipboardOfferActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: spacing.sm,
    },
    clipboardOfferButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
    },
    clipboardOfferButtonPrimary: {
        backgroundColor: colors.primaryLight,
    },
    clipboardOfferDismissText: {
        ...typography.subhead,
        color: colors.textTertiary,
    },
    clipboardOfferAcceptText: {
        ...typography.subhead,
        color: colors.primary,
        fontWeight: "600",
    },
    // ...
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    // ...
    copyIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    waitingBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        ...typography.title1,
        color: colors.text,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        justifyContent: "center",
    },
    iconSection: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    iconGradient: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
        ...shadows.lg,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        maxWidth: 280,
    },
    sealedCountText: {
        ...typography.body,
        color: colors.text,
        textAlign: "center",
    },
    section: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        ...typography.caption1,
        color: colors.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },

    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: spacing.lg,
    },

    dividerText: {
        ...typography.subhead,
        color: colors.textTertiary,
        paddingHorizontal: spacing.md,
    },
    codeContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    code: {
        ...typography.largeTitle,
        color: colors.text,
        letterSpacing: 6,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },

    tapToCopy: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: "center",
        marginTop: spacing.sm,
    },
    waitingSection: {
        alignItems: "center",
        marginTop: spacing.xl,
    },

    waitingText: {
        ...typography.subhead,
        color: colors.textTertiary,
    },
    cancelSection: {
        alignItems: "center",
        marginTop: spacing.xl,
    },
    cancelButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    cancelButtonText: {
        ...typography.subhead,
        color: colors.error,
    },
    ctaSection: {
        alignItems: "center",
        marginBottom: spacing.md,
    },
    ctaText: {
        ...typography.callout,
        color: colors.textSecondary,
        textAlign: "center",
    },
    quickShareRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    quickShareButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickShareLabel: {
        ...typography.subhead,
        color: colors.text,
    },
});
