import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Share,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "../../src/store";
import { supabase } from "../../src/lib/supabase";
import { getPairingError } from "../../src/lib/errors";
import { Events } from "../../src/lib/analytics";
import { router } from "expo-router";
import { GradientBackground, GlassCard, GlassButton } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography, shadows } from "../../src/theme";

export default function PairingScreen() {
    const { user, fetchCouple, fetchUser, couple, partner, isLoading: isAuthLoading } = useAuthStore();
    const [inviteCode, setInviteCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirect if already paired
    useEffect(() => {
        if (couple && partner) {
            router.replace("/(app)/");
        }
    }, [couple, partner]);

    // Subscribe to real-time updates for partner joining + polling fallback
    useEffect(() => {
        if (!couple || partner) return;

        // Poll every 5 seconds as fallback
        const pollInterval = setInterval(() => {
            fetchCouple();
        }, 5000);

        // Listen for new profiles joining this couple
        const subscription = supabase
            .channel(`couple-${couple.id}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `couple_id=eq.${couple.id}`,
                },
                async (payload) => {
                    // Someone updated their profile to join this couple
                    if (payload.new.id !== user?.id) {
                        await fetchCouple();
                    }
                }
            )
            .subscribe();

        return () => {
            clearInterval(pollInterval);
            subscription.unsubscribe();
        };
    }, [couple, partner, user?.id, fetchCouple]);

    const handleCreateCouple = async () => {
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.functions.invoke("manage-couple", {
                method: "POST",
                body: {},
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

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
            // Refresh session to ensure we have a valid token
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error("Please log in again");
            }

            const { data, error } = await supabase.functions.invoke("manage-couple", {
                method: "POST",
                body: { invite_code: sanitizedCode },
            });

            if (error) {
                // Extract user-friendly error message
                const errorMessage = data?.error || "Unable to join couple. Please try again.";
                throw new Error(errorMessage);
            }
            if (data?.error) throw new Error(data.error);

            await fetchUser(); // Refresh user to get couple_id
            await fetchCouple(); // Fetch couple data
            Events.coupleJoined();

            Alert.alert("Success", "You are now paired!", [
                { text: "Let's Go", onPress: () => router.replace("/(app)/") }
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
            Alert.alert("Copied", "Invite code copied to clipboard");
        }
    };

    const shareCode = async () => {
        if (couple?.invite_code) {
            try {
                await Share.share({
                    message: `Join me on Sauci! Use my invite code to pair up: ${couple.invite_code}`,
                });
                Events.codeShared();
            } catch (error) {
                console.error(error);
            }
        }
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
                            const { data, error } = await supabase.functions.invoke("manage-couple", {
                                method: "DELETE",
                            });

                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);

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

                        {/* Share Button */}
                        <Animated.View
                            entering={FadeInDown.delay(400).duration(500)}
                            style={styles.section}
                        >
                            <GlassButton
                                onPress={shareCode}
                                fullWidth
                                icon={<Ionicons name="share-outline" size={20} color={colors.text} />}
                            >
                                Share Code
                            </GlassButton>
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

                    {/* Join Card */}
                    <Animated.View
                        entering={FadeInDown.delay(300).duration(500)}
                        style={styles.section}
                    >
                        <Text style={styles.sectionTitle}>Have a code?</Text>
                        <GlassCard>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter invite code"
                                placeholderTextColor={colors.textTertiary}
                                value={inviteCode}
                                onChangeText={setInviteCode}
                                autoCapitalize="characters"
                                maxLength={8}
                            />
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
        paddingTop: Platform.OS === "ios" ? 60 : 40,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
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
    input: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.md,
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
        letterSpacing: 4,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        marginBottom: spacing.md,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.glass.border,
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
    copyIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: spacing.md,
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
    waitingBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.glass.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.sm,
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
});
