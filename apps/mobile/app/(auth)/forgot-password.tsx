import { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import Animated, {
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { getAuthError } from "../../src/lib/errors";
import { GradientBackground, GlassCard, GlassButton, GlassInput } from "../../src/components/ui";
import { colors, spacing, radius, typography } from "../../src/theme";

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Cooldown timer for resend
    useEffect(() => {
        if (resendCooldown <= 0) return;

        const timer = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [resendCooldown]);

    const showError = (message: string) => {
        setError(message);
        if (Platform.OS !== 'web') {
            Alert.alert("Error", message);
        }
    };

    const clearError = () => setError(null);

    const handleResetPassword = async () => {
        clearError();
        if (!email.trim()) {
            showError("Please enter your email");
            return;
        }

        setIsLoading(true);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
                redirectTo: Linking.createURL("/(auth)/reset-password"),
            }
        );
        setIsLoading(false);

        if (resetError) {
            showError(getAuthError(resetError));
        } else {
            setIsEmailSent(true);
            setResendCooldown(60);
        }
    };

    const handleResend = useCallback(async () => {
        if (resendCooldown > 0) return;

        setIsResending(true);
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
                redirectTo: Linking.createURL("/(auth)/reset-password"),
            }
        );
        setIsResending(false);

        if (resendError) {
            if (Platform.OS !== 'web') {
                Alert.alert("Error", getAuthError(resendError));
            }
        } else {
            setResendCooldown(60);
            if (Platform.OS !== 'web') {
                Alert.alert("Email Sent", "A new password reset email has been sent.");
            }
        }
    }, [email, resendCooldown]);

    // Email sent confirmation screen
    if (isEmailSent) {
        return (
            <GradientBackground showAccent>
                <View style={styles.centeredContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.centeredContent}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="mail" size={48} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Check your email</Text>
                        <Text style={styles.subtitle}>
                            We sent a password reset link to{'\n'}
                            <Text style={styles.emailHighlight}>{email}</Text>
                        </Text>
                        <Text style={styles.hint}>
                            Click the link in your email to reset your password.
                        </Text>
                        <GlassButton
                            variant="secondary"
                            onPress={handleResend}
                            loading={isResending}
                            disabled={isResending || resendCooldown > 0}
                            style={{ marginTop: spacing.lg }}
                        >
                            {resendCooldown > 0
                                ? `Resend email (${resendCooldown}s)`
                                : "Resend email"}
                        </GlassButton>
                        <GlassButton
                            variant="ghost"
                            onPress={() => {
                                setIsEmailSent(false);
                                setEmail("");
                                setResendCooldown(0);
                            }}
                            style={{ marginTop: spacing.sm }}
                        >
                            Try a different email
                        </GlassButton>
                        <GlassButton
                            variant="ghost"
                            onPress={() => router.back()}
                            style={{ marginTop: spacing.sm }}
                        >
                            Back to login
                        </GlassButton>
                    </Animated.View>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground showAccent>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        {/* Back Button */}
                        <Animated.View
                            entering={FadeInDown.delay(100).duration(600).springify()}
                        >
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => router.back()}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Header */}
                        <Animated.View
                            entering={FadeInDown.delay(150).duration(600).springify()}
                            style={styles.headerContainer}
                        >
                            <View style={styles.logoContainer}>
                                <Ionicons name="key" size={40} color={colors.primary} />
                            </View>
                            <Text style={styles.title}>Reset Password</Text>
                            <Text style={styles.subtitle}>
                                Enter your email and we'll send you a link to reset your password
                            </Text>
                        </Animated.View>

                        {/* Form Card */}
                        <Animated.View
                            entering={FadeInDown.delay(200).duration(600).springify()}
                            style={styles.formContainer}
                        >
                            <GlassCard variant="elevated">
                                {/* Error Message */}
                                {error && (
                                    <Animated.View
                                        entering={FadeInDown.duration(200)}
                                        style={styles.errorContainer}
                                    >
                                        <Ionicons name="alert-circle" size={18} color={colors.error} />
                                        <Text style={styles.errorText}>{error}</Text>
                                    </Animated.View>
                                )}

                                {/* Form Fields */}
                                <View style={styles.form}>
                                    <GlassInput
                                        placeholder="Enter your email"
                                        value={email}
                                        onChangeText={(text) => { clearError(); setEmail(text); }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoFocus
                                        icon={<Ionicons name="mail-outline" size={20} color={colors.textTertiary} />}
                                    />

                                    <GlassButton
                                        onPress={handleResetPassword}
                                        loading={isLoading}
                                        disabled={isLoading}
                                        fullWidth
                                    >
                                        Send Reset Link
                                    </GlassButton>
                                </View>
                            </GlassCard>
                        </Animated.View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centeredContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    centeredContent: {
        alignItems: "center",
        paddingHorizontal: spacing.lg,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: 60,
        paddingBottom: spacing.xl,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    headerContainer: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.largeTitle,
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: "center",
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
    emailHighlight: {
        color: colors.primary,
        fontWeight: "600",
    },
    hint: {
        ...typography.subhead,
        color: colors.textSecondary,
        textAlign: "center",
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
    },
    formContainer: {
        marginBottom: spacing.lg,
    },
    errorContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.errorLight,
        padding: spacing.md,
        borderRadius: radius.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    errorText: {
        ...typography.subhead,
        color: colors.error,
        flex: 1,
    },
    form: {
        gap: spacing.sm,
    },
});
