import { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { router } from "expo-router";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { getAuthError } from "../../src/lib/errors";
import { GradientBackground, GlassCard, GlassButton, GlassInput } from "../../src/components/ui";
import { colors, spacing, radius, typography } from "../../src/theme";

export default function ResetPasswordScreen() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const showError = (message: string) => {
        setError(message);
        if (Platform.OS !== 'web') {
            Alert.alert("Error", message);
        }
    };

    const clearError = () => setError(null);

    const handleResetPassword = async () => {
        clearError();

        // Validate password
        if (!password) {
            showError("Please enter a new password");
            return;
        }
        if (password.length < 8) {
            showError("Password must be at least 8 characters");
            return;
        }
        if (password !== confirmPassword) {
            showError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        const { error: updateError } = await supabase.auth.updateUser({
            password,
        });
        setIsLoading(false);

        if (updateError) {
            showError(getAuthError(updateError));
        } else {
            setIsSuccess(true);
        }
    };

    const handleContinue = () => {
        // Navigate to main app
        router.replace("/");
    };

    // Success screen
    if (isSuccess) {
        return (
            <GradientBackground showAccent>
                <View style={styles.centeredContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.centeredContent}
                    >
                        <View style={styles.successIconContainer}>
                            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                        </View>
                        <Text style={styles.title}>Password Updated</Text>
                        <Text style={styles.subtitle}>
                            Your password has been successfully reset. You can now use your new password to sign in.
                        </Text>
                        <GlassButton
                            onPress={handleContinue}
                            style={{ marginTop: spacing.xl }}
                        >
                            Continue to App
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
                        {/* Header */}
                        <Animated.View
                            entering={FadeInDown.delay(100).duration(600).springify()}
                            style={styles.headerContainer}
                        >
                            <View style={styles.logoContainer}>
                                <Ionicons name="lock-open" size={40} color={colors.primary} />
                            </View>
                            <Text style={styles.title}>Create New Password</Text>
                            <Text style={styles.subtitle}>
                                Enter your new password below
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
                                        entering={FadeIn.duration(200)}
                                        style={styles.errorContainer}
                                    >
                                        <Ionicons name="alert-circle" size={18} color={colors.error} />
                                        <Text style={styles.errorText}>{error}</Text>
                                    </Animated.View>
                                )}

                                {/* Form Fields */}
                                <View style={styles.form}>
                                    <GlassInput
                                        placeholder="New password"
                                        value={password}
                                        onChangeText={(text) => { clearError(); setPassword(text); }}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        autoFocus
                                        icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />}
                                    />

                                    <GlassInput
                                        placeholder="Confirm new password"
                                        value={confirmPassword}
                                        onChangeText={(text) => { clearError(); setConfirmPassword(text); }}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />}
                                    />

                                    <Text style={styles.passwordHint}>
                                        Password must be at least 8 characters
                                    </Text>

                                    <GlassButton
                                        onPress={handleResetPassword}
                                        loading={isLoading}
                                        disabled={isLoading}
                                        fullWidth
                                    >
                                        Reset Password
                                    </GlassButton>
                                </View>
                            </GlassCard>
                        </Animated.View>

                        {/* Back to Login Link */}
                        <Animated.View
                            entering={FadeInDown.delay(300).duration(600).springify()}
                            style={styles.footerContainer}
                        >
                            <GlassButton
                                variant="ghost"
                                onPress={() => router.replace("/(auth)/login")}
                            >
                                Back to login
                            </GlassButton>
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
        paddingTop: 80,
        paddingBottom: spacing.xl,
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
    successIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.successLight,
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
    passwordHint: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: "center",
        marginTop: spacing.xs,
    },
    footerContainer: {
        alignItems: "center",
    },
});
