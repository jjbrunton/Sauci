import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Platform,
    Alert,
    TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

// Safely import platform auth modules
let AppleAuthentication: typeof import("expo-apple-authentication") | null = null;
let GoogleSignin: typeof import("@react-native-google-signin/google-signin").GoogleSignin | null = null;

if (Platform.OS === "ios") {
    try {
        AppleAuthentication = require("expo-apple-authentication");
    } catch {
        AppleAuthentication = null;
    }
}

if (Platform.OS === "android") {
    try {
        const googleModule = require("@react-native-google-signin/google-signin");
        GoogleSignin = googleModule.GoogleSignin;
        if (GoogleSignin) {
            GoogleSignin.configure({
                webClientId: "764866133492-e78o2rh3rdjc4rfj2j6r2j77b065kggm.apps.googleusercontent.com",
            });
        }
    } catch {
        GoogleSignin = null;
    }
}

import { GradientBackground, GlassButton, GlassCard, GlassInput } from "../../../components/ui";
import { colors, spacing, radius, typography } from "../../../theme";
import { supabase } from "../../../lib/supabase";
import { getAuthError } from "../../../lib/errors";
import { useAuthStore } from "../../../store";
import { ScreenHeader } from "../components";

type SaveMode = "magic-link" | "password";

export function SaveAccountScreen() {
    const router = useRouter();
    const { isAnonymous, fetchUser } = useAuthStore();

    const [mode, setMode] = useState<SaveMode>("magic-link");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [pendingEmail, setPendingEmail] = useState<string | null>(null);
    const [pendingPassword, setPendingPassword] = useState<string | null>(null);

    const [isAppleAvailable, setIsAppleAvailable] = useState(false);
    const [isGoogleAvailable, setIsGoogleAvailable] = useState(false);

    useEffect(() => {
        if (Platform.OS === "ios" && AppleAuthentication) {
            AppleAuthentication.isAvailableAsync()
                .then(setIsAppleAvailable)
                .catch(() => setIsAppleAvailable(false));
        }
        if (Platform.OS === "android" && GoogleSignin) {
            setIsGoogleAvailable(true);
        }
    }, []);

    const emailRedirectTo = useMemo(() => Linking.createURL("/(auth)/login"), []);

    const showError = useCallback((message: string) => {
        Alert.alert("Error", message);
    }, []);

    const showSuccess = useCallback((message: string) => {
        Alert.alert("Success", message);
    }, []);

    const syncProfileEmail = useCallback(async (userId: string, nextEmail: string | null | undefined) => {
        if (!nextEmail) return;
        try {
            await supabase
                .from("profiles")
                .update({ email: nextEmail })
                .eq("id", userId);
        } catch {
            // Non-blocking (some envs may restrict this by RLS)
        }
    }, []);

    const handleSaveWithEmail = useCallback(async () => {
        if (!email.trim()) {
            showError("Please enter your email");
            return;
        }
        if (mode === "password" && password.length < 8) {
            showError("Password must be at least 8 characters");
            return;
        }

        setIsSubmitting(true);
        const { error } = await supabase.auth.updateUser(
            { email: email.trim() },
            { emailRedirectTo } as any
        );
        setIsSubmitting(false);

        if (error) {
            const friendly = getAuthError(error);
            if (__DEV__ && friendly === "Something went wrong. Please try again.") {
                showError(`${friendly}\n\n${error.message}`);
            } else {
                showError(friendly);
            }
            return;
        }

        setPendingEmail(email.trim());
        setPendingPassword(mode === "password" ? password : null);

        Alert.alert(
            "Check your email",
            "We sent you a link to confirm your email. Once you confirm, come back and tap “I’ve verified my email”."
        );
    }, [email, password, mode, emailRedirectTo, showError]);

    const handleCheckVerification = useCallback(async () => {
        setIsChecking(true);
        const { data: { user }, error } = await supabase.auth.getUser();
        setIsChecking(false);

        if (error || !user) {
            showError(getAuthError(error) || "Unable to check account status");
            return;
        }

        const isStillAnonymous = !!(user as any).is_anonymous;
        if (isStillAnonymous) {
            Alert.alert("Not yet verified", "Please click the link in your email to finish saving your account.");
            return;
        }

        // If user chose password mode, set password after email is verified
        if (pendingPassword) {
            setIsSubmitting(true);
            const { error: passwordError } = await supabase.auth.updateUser({ password: pendingPassword });
            setIsSubmitting(false);

            if (passwordError) {
                showError(getAuthError(passwordError));
                return;
            }
        }

        await syncProfileEmail(user.id, user.email);
        await fetchUser();

        showSuccess("Account saved. You can now recover your account on any device.");
        router.navigate("/(app)/profile" as any);
    }, [pendingPassword, fetchUser, showError, showSuccess, router, syncProfileEmail]);

    const handleLinkApple = useCallback(async () => {
        if (!AppleAuthentication) return;

        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                showError("No identity token received from Apple");
                return;
            }

            setIsSubmitting(true);
            const { error } = await (supabase.auth.linkIdentity as any)({
                provider: "apple",
                token: credential.identityToken,
            });
            setIsSubmitting(false);

            if (error) {
                showError(getAuthError(error));
                return;
            }

            // Apple only provides name/email on first auth grant
            if (credential.fullName) {
                const nameParts = [
                    credential.fullName.givenName,
                    credential.fullName.middleName,
                    credential.fullName.familyName,
                ].filter(Boolean);
                const fullName = nameParts.join(" ");

                if (fullName) {
                    await supabase.auth.updateUser({
                        data: {
                            full_name: fullName,
                            given_name: credential.fullName.givenName,
                            family_name: credential.fullName.familyName,
                        },
                    });
                }
            }

            // Refresh user/profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await syncProfileEmail(user.id, user.email);
            }
            await fetchUser();

            showSuccess("Account saved with Apple.");
            router.navigate("/(app)/profile" as any);
        } catch (e: any) {
            if (e?.code === "ERR_REQUEST_CANCELED") return;
            showError("Apple sign in failed. Please try again.");
        }
    }, [fetchUser, router, showError, showSuccess, syncProfileEmail]);

    const handleLinkGoogle = useCallback(async () => {
        if (!GoogleSignin) return;

        try {
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();

            if (response.type !== "success" || !response.data.idToken) {
                return;
            }

            setIsSubmitting(true);
            const { error } = await (supabase.auth.linkIdentity as any)({
                provider: "google",
                token: response.data.idToken,
            });
            setIsSubmitting(false);

            if (error) {
                showError(getAuthError(error));
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await syncProfileEmail(user.id, user.email);
            }
            await fetchUser();

            showSuccess("Account saved with Google.");
            router.navigate("/(app)/profile" as any);
        } catch {
            showError("Google sign in failed. Please try again.");
        }
    }, [fetchUser, router, showError, showSuccess, syncProfileEmail]);

    const showSocial = Platform.select({ ios: true, android: true, default: false });

    if (!isAnonymous) {
        return (
            <GradientBackground>
                <ScreenHeader title="Save Account" />
                <View style={styles.centered}>
                    <GlassCard variant="elevated" style={styles.readyCard}>
                        <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                        <Text style={styles.readyTitle}>Your account is already saved</Text>
                        <Text style={styles.readyBody}>
                            You're signed in with a recoverable account.
                        </Text>
                        <GlassButton onPress={() => router.navigate("/(app)/profile" as any)}>
                            Back to Settings
                        </GlassButton>
                    </GlassCard>
                </View>
            </GradientBackground>
        );
    }

    if (pendingEmail) {
        return (
            <GradientBackground>
                <ScreenHeader title="Save Account" />
                <View style={styles.centered}>
                    <GlassCard variant="elevated" style={styles.verifyCard}>
                        <View style={styles.verifyIcon}>
                            <Ionicons name="mail-unread" size={36} color={colors.primary} />
                        </View>
                        <Text style={styles.verifyTitle}>Confirm your email</Text>
                        <Text style={styles.verifyBody}>
                            We sent a confirmation link to {pendingEmail}. Tap it, then come back here.
                        </Text>

                        <GlassButton
                            onPress={handleCheckVerification}
                            loading={isChecking || isSubmitting}
                            disabled={isChecking || isSubmitting}
                            fullWidth
                        >
                            I've verified my email
                        </GlassButton>
                        <GlassButton
                            variant="secondary"
                            onPress={handleSaveWithEmail}
                            loading={isSubmitting}
                            disabled={isSubmitting}
                            fullWidth
                            style={{ marginTop: spacing.sm }}
                        >
                            Resend email
                        </GlassButton>
                        <GlassButton
                            variant="ghost"
                            onPress={() => {
                                setPendingEmail(null);
                                setPendingPassword(null);
                            }}
                            fullWidth
                            style={{ marginTop: spacing.sm }}
                        >
                            Use a different email
                        </GlassButton>
                    </GlassCard>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            <ScreenHeader title="Save Account" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <GlassCard variant="elevated" style={styles.heroCard}>
                    <Text style={styles.heroTitle}>Protect your account</Text>
                    <Text style={styles.heroBody}>
                        Unsaved accounts can't be recovered if you delete the app or switch devices.
                        Save your account to keep your couple, matches, and purchases.
                    </Text>
                </GlassCard>

                {showSocial && (
                    <GlassCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Quick save</Text>

                        {Platform.OS === "ios" && (
                            <View style={styles.socialRow}>
                                {isAppleAvailable && AppleAuthentication ? (
                                    <AppleAuthentication.AppleAuthenticationButton
                                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                                        cornerRadius={12}
                                        style={styles.appleButton}
                                        onPress={handleLinkApple}
                                    />
                                ) : (
                                    <GlassButton
                                        variant="secondary"
                                        onPress={handleLinkApple}
                                        icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
                                        fullWidth
                                        disabled={isSubmitting}
                                    >
                                        Save with Apple
                                    </GlassButton>
                                )}
                            </View>
                        )}

                        {Platform.OS === "android" && isGoogleAvailable && (
                            <GlassButton
                                variant="secondary"
                                onPress={handleLinkGoogle}
                                icon={<Ionicons name="logo-google" size={20} color={colors.text} />}
                                fullWidth
                                disabled={isSubmitting}
                            >
                                Save with Google
                            </GlassButton>
                        )}

                        <Text style={styles.sectionHint}>
                            Use an account that isn't already linked to Sauci.
                        </Text>
                    </GlassCard>
                )}

                <GlassCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Save with email</Text>

                    <View style={styles.modeToggleContainer}>
                        <TouchableOpacity
                            style={[styles.modeToggle, mode === "magic-link" && styles.modeToggleActive]}
                            onPress={() => setMode("magic-link")}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.modeToggleText, mode === "magic-link" && styles.modeToggleTextActive]}>
                                Magic Link
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeToggle, mode === "password" && styles.modeToggleActive]}
                            onPress={() => setMode("password")}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.modeToggleText, mode === "password" && styles.modeToggleTextActive]}>
                                Password
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        <GlassInput
                            placeholder="Enter your email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            icon={<Ionicons name="mail-outline" size={20} color={colors.textTertiary} />}
                        />

                        {mode === "password" && (
                            <GlassInput
                                placeholder="Create a password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />}
                            />
                        )}

                        <GlassButton
                            onPress={handleSaveWithEmail}
                            loading={isSubmitting}
                            disabled={isSubmitting}
                            fullWidth
                        >
                            Save with Email
                        </GlassButton>
                    </View>

                    <Text style={styles.sectionHint}>
                        We'll send a confirmation link to your email.
                    </Text>
                </GlassCard>

                <View style={{ height: spacing.xl }} />
            </ScrollView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingTop: spacing.lg,
        paddingBottom: Platform.OS === "ios" ? 40 : 20,
        gap: spacing.lg,
    },
    heroCard: {
        marginHorizontal: spacing.lg,
    },
    heroTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    heroBody: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    sectionCard: {
        marginHorizontal: spacing.lg,
    },
    sectionTitle: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.md,
    },
    sectionHint: {
        ...typography.caption1,
        color: colors.textTertiary,
        marginTop: spacing.md,
    },
    socialRow: {
        marginBottom: spacing.sm,
    },
    appleButton: {
        width: "100%",
        height: 48,
    },
    modeToggleContainer: {
        flexDirection: "row",
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        padding: 4,
        marginBottom: spacing.md,
    },
    modeToggle: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: radius.sm,
        alignItems: "center",
    },
    modeToggleActive: {
        backgroundColor: colors.primary,
    },
    modeToggleText: {
        ...typography.subhead,
        color: colors.textTertiary,
        fontWeight: "600",
    },
    modeToggleTextActive: {
        color: colors.text,
    },
    form: {
        gap: spacing.sm,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    readyCard: {
        width: "100%",
        maxWidth: 420,
        alignItems: "center",
        gap: spacing.sm,
    },
    readyTitle: {
        ...typography.title3,
        color: colors.text,
        marginTop: spacing.sm,
    },
    readyBody: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    verifyCard: {
        width: "100%",
        maxWidth: 420,
        alignItems: "center",
        padding: spacing.lg,
    },
    verifyIcon: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    verifyTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    verifyBody: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
});

export default SaveAccountScreen;
