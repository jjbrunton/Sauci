import { useState } from "react";
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
import { Redirect } from "expo-router";
import * as Linking from "expo-linking";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useAuthStore } from "../../src/store";
import { GradientBackground, GlassCard, GlassButton, GlassInput } from "../../src/components/ui";
import { colors, spacing, radius, typography } from "../../src/theme";

type AuthMode = "magic-link" | "password";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
    const [authMode, setAuthMode] = useState<AuthMode>("magic-link");
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { isAuthenticated } = useAuthStore();

    const showError = (message: string) => {
        setError(message);
        // Also show native alert on mobile
        if (Platform.OS !== 'web') {
            Alert.alert("Error", message);
        }
    };

    const clearError = () => setError(null);

    if (isAuthenticated) {
        return <Redirect href="/" />;
    }

    const handleMagicLink = async () => {
        clearError();
        if (!email.trim()) {
            showError("Please enter your email");
            return;
        }

        setIsLoading(true);
        const { error: authError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: Linking.createURL("/(auth)/login"),
            },
        });

        setIsLoading(false);

        if (authError) {
            showError(authError.message);
        } else {
            setIsMagicLinkSent(true);
        }
    };

    const handlePasswordAuth = async () => {
        clearError();
        if (!email.trim()) {
            showError("Please enter your email");
            return;
        }
        if (!password) {
            showError("Please enter your password");
            return;
        }
        if (isSignUp && password.length < 6) {
            showError("Password must be at least 6 characters");
            return;
        }

        setIsLoading(true);

        if (isSignUp) {
            const { error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
            });

            setIsLoading(false);

            if (signUpError) {
                showError(signUpError.message);
            } else {
                // Show success message
                if (Platform.OS === 'web') {
                    setError(null);
                    Alert.alert(
                        "Check your email",
                        "We sent you a confirmation link to verify your email address."
                    );
                } else {
                    Alert.alert(
                        "Check your email",
                        "We sent you a confirmation link to verify your email address.",
                        [{ text: "OK" }]
                    );
                }
            }
        } else {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            setIsLoading(false);

            if (signInError) {
                showError(signInError.message);
            }
        }
    };

    const handleGoogleSignIn = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: Linking.createURL("/(auth)/login"),
            },
        });

        if (error) {
            Alert.alert("Error", error.message);
        }
    };

    const handleAppleSignIn = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "apple",
            options: {
                redirectTo: Linking.createURL("/(auth)/login"),
            },
        });

        if (error) {
            Alert.alert("Error", error.message);
        }
    };

    if (isMagicLinkSent) {
        return (
            <GradientBackground showAccent>
                <View style={styles.container}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.content}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="mail" size={48} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Check your email</Text>
                        <Text style={styles.subtitle}>
                            We sent a magic link to{'\n'}
                            <Text style={styles.emailHighlight}>{email}</Text>
                        </Text>
                        <GlassButton
                            variant="ghost"
                            onPress={() => setIsMagicLinkSent(false)}
                            style={{ marginTop: spacing.lg }}
                        >
                            Try a different email
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
                        {/* Logo/Brand */}
                        <Animated.View
                            entering={FadeInDown.delay(100).duration(600).springify()}
                            style={styles.brandContainer}
                        >
                            <View style={styles.logoContainer}>
                                <Ionicons name="heart" size={40} color={colors.primary} />
                            </View>
                            <Text style={styles.title}>Sauci</Text>
                            <Text style={styles.subtitle}>
                                Explore intimacy together
                            </Text>
                        </Animated.View>

                        {/* Auth Card */}
                        <Animated.View
                            entering={FadeInDown.delay(200).duration(600).springify()}
                            style={styles.formContainer}
                        >
                            <GlassCard variant="elevated">
                                {/* Auth Mode Toggle */}
                                <View style={styles.modeToggleContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.modeToggle,
                                            authMode === "magic-link" && styles.modeToggleActive,
                                        ]}
                                        onPress={() => setAuthMode("magic-link")}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.modeToggleText,
                                                authMode === "magic-link" && styles.modeToggleTextActive,
                                            ]}
                                        >
                                            Magic Link
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.modeToggle,
                                            authMode === "password" && styles.modeToggleActive,
                                        ]}
                                        onPress={() => setAuthMode("password")}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.modeToggleText,
                                                authMode === "password" && styles.modeToggleTextActive,
                                            ]}
                                        >
                                            Password
                                        </Text>
                                    </TouchableOpacity>
                                </View>

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
                                        placeholder="Enter your email"
                                        value={email}
                                        onChangeText={(text) => { clearError(); setEmail(text); }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        icon={<Ionicons name="mail-outline" size={20} color={colors.textTertiary} />}
                                    />

                                    {authMode === "password" && (
                                        <GlassInput
                                            placeholder="Enter your password"
                                            value={password}
                                            onChangeText={(text) => { clearError(); setPassword(text); }}
                                            secureTextEntry
                                            autoCapitalize="none"
                                            icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />}
                                        />
                                    )}

                                    {authMode === "magic-link" ? (
                                        <GlassButton
                                            onPress={handleMagicLink}
                                            loading={isLoading}
                                            disabled={isLoading}
                                            fullWidth
                                        >
                                            Continue with Magic Link
                                        </GlassButton>
                                    ) : (
                                        <>
                                            <GlassButton
                                                onPress={handlePasswordAuth}
                                                loading={isLoading}
                                                disabled={isLoading}
                                                fullWidth
                                            >
                                                {isSignUp ? "Create Account" : "Sign In"}
                                            </GlassButton>
                                            <TouchableOpacity
                                                style={styles.toggleSignUp}
                                                onPress={() => setIsSignUp(!isSignUp)}
                                            >
                                                <Text style={styles.toggleSignUpText}>
                                                    {isSignUp
                                                        ? "Already have an account? Sign In"
                                                        : "Don't have an account? Sign Up"}
                                                </Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            </GlassCard>
                        </Animated.View>

                        {/* Social Sign In */}
                        <Animated.View
                            entering={FadeInDown.delay(300).duration(600).springify()}
                            style={styles.socialContainer}
                        >
                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>or continue with</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <View style={styles.socialButtons}>
                                <GlassButton
                                    variant="secondary"
                                    onPress={handleGoogleSignIn}
                                    icon={<Ionicons name="logo-google" size={20} color={colors.text} />}
                                    style={styles.socialButton}
                                >
                                    Google
                                </GlassButton>

                                <GlassButton
                                    variant="secondary"
                                    onPress={handleAppleSignIn}
                                    icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
                                    style={styles.socialButton}
                                >
                                    Apple
                                </GlassButton>
                            </View>
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
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: 80,
        paddingBottom: spacing.xl,
    },
    brandContainer: {
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
    title: {
        ...typography.largeTitle,
        color: colors.text,
        marginBottom: spacing.xs,
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
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    formContainer: {
        marginBottom: spacing.lg,
    },
    modeToggleContainer: {
        flexDirection: "row",
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        padding: 4,
        marginBottom: spacing.lg,
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
    toggleSignUp: {
        marginTop: spacing.md,
        alignItems: "center",
    },
    toggleSignUpText: {
        ...typography.subhead,
        color: colors.primary,
    },
    socialContainer: {
        marginTop: spacing.md,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.glass.border,
    },
    dividerText: {
        ...typography.caption1,
        color: colors.textTertiary,
        paddingHorizontal: spacing.md,
    },
    socialButtons: {
        flexDirection: "row",
        gap: spacing.md,
    },
    socialButton: {
        flex: 1,
    },
});
