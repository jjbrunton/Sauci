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
    Image,
} from "react-native";
import { Redirect, router } from "expo-router";
import * as Linking from "expo-linking";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
// Safely import Apple Authentication - may not be available in Expo Go
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
import { supabase } from "../../src/lib/supabase";
import { getAuthError } from "../../src/lib/errors";
import { Events } from "../../src/lib/analytics";
import { useAuthStore } from "../../src/store";
import { GradientBackground, GlassCard, GlassButton, GlassInput } from "../../src/components/ui";
import { colors, spacing, radius, typography } from "../../src/theme";

type AuthMode = "magic-link" | "password";

interface PendingVerification {
    email: string;
    password: string;
}

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGuestLoading, setIsGuestLoading] = useState(false);
    const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
    const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
    const [isCheckingVerification, setIsCheckingVerification] = useState(false);
    const [isResendingEmail, setIsResendingEmail] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [authMode, setAuthMode] = useState<AuthMode>("magic-link");
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
    const [isGoogleAuthAvailable, setIsGoogleAuthAvailable] = useState(false);
    const { isAuthenticated } = useAuthStore();

    // Check Apple Auth availability asynchronously
    useEffect(() => {
        if (Platform.OS === "ios" && AppleAuthentication) {
            AppleAuthentication.isAvailableAsync().then((available) => {
                setIsAppleAuthAvailable(available);
            }).catch(() => {
                setIsAppleAuthAvailable(false);
            });
        }
    }, []);

    // Check Google Auth availability
    useEffect(() => {
        if (Platform.OS === "android" && GoogleSignin) {
            setIsGoogleAuthAvailable(true);
        }
    }, []);

    // Cooldown timer for resend verification email
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

    // Resend verification email
    const resendVerificationEmail = useCallback(async () => {
        if (!pendingVerification || resendCooldown > 0) return;

        setIsResendingEmail(true);
        const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: pendingVerification.email,
        });
        setIsResendingEmail(false);

        if (resendError) {
            if (Platform.OS !== 'web') {
                Alert.alert("Error", getAuthError(resendError));
            }
        } else {
            // Start 60 second cooldown
            setResendCooldown(60);
            if (Platform.OS !== 'web') {
                Alert.alert("Email Sent", "A new verification email has been sent. Please check your inbox.");
            }
        }
    }, [pendingVerification, resendCooldown]);

    // Check if user has verified their email
    const checkVerificationStatus = useCallback(async () => {
        if (!pendingVerification) return;

        setIsCheckingVerification(true);
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: pendingVerification.email,
            password: pendingVerification.password,
        });
        setIsCheckingVerification(false);

        if (signInError) {
            if (signInError.message.includes("Email not confirmed")) {
                // Still not verified - show a message
                if (Platform.OS !== 'web') {
                    Alert.alert("Not yet verified", "Please check your email and click the verification link.");
                }
            } else {
                Alert.alert("Error", getAuthError(signInError));
            }
        }
        // If successful, the auth state change will handle the redirect
    }, [pendingVerification]);

    // Listen for auth state changes (e.g., when user verifies in another tab/browser)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // User verified and signed in - clear pending state
                setPendingVerification(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

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
            showError(getAuthError(authError));
        } else {
            setIsMagicLinkSent(true);
            Events.signIn("magic_link");
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
        if (isSignUp && password.length < 8) {
            showError("Password must be at least 8 characters");
            return;
        }

        setIsLoading(true);

        if (isSignUp) {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    emailRedirectTo: Linking.createURL("/(auth)/login"),
                },
            });

            setIsLoading(false);

            if (signUpError) {
                showError(getAuthError(signUpError));
            } else if (data.user && data.user.identities && data.user.identities.length === 0) {
                // User already exists - Supabase returns success but empty identities
                // for security (prevents email enumeration)
                showError("An account with this email already exists. Please sign in instead.");
            } else {
                // Show the verification pending screen
                setPendingVerification({
                    email: email.trim(),
                    password,
                });
                Events.signUp("password");
            }
        } else {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            setIsLoading(false);

            if (!signInError) {
                Events.signIn("password");
            } else if (signInError) {
                // Check if the error is due to unverified email
                if (signInError.message.includes("Email not confirmed")) {
                    // Show the verification pending screen
                    setPendingVerification({
                        email: email.trim(),
                        password,
                    });
                } else {
                    showError(getAuthError(signInError));
                }
            }
        }
    };

    const handleAppleSignIn = async () => {
        console.log("[Apple Sign In] Starting, isAppleAuthAvailable:", isAppleAuthAvailable, "AppleAuthentication:", !!AppleAuthentication);

        if (isAppleAuthAvailable && AppleAuthentication) {
            try {
                console.log("[Apple Sign In] Calling signInAsync...");
                const credential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    ],
                });
                console.log("[Apple Sign In] Got credential:", !!credential, "identityToken:", !!credential?.identityToken);

                if (credential.identityToken) {
                    const { error } = await supabase.auth.signInWithIdToken({
                        provider: "apple",
                        token: credential.identityToken,
                    });

                    if (error) {
                        console.log("[Apple Sign In] Supabase error:", error.message);
                        Alert.alert("Error", getAuthError(error));
                    } else {
                        Events.signIn("apple");
                    }
                } else {
                    Alert.alert("Error", "No identity token received from Apple");
                }
            } catch (e: any) {
                console.log("[Apple Sign In] Caught error:", e.code, e.message);
                if (e.code === "ERR_REQUEST_CANCELED") {
                    // User canceled - do nothing
                } else {
                    Alert.alert("Error", "Apple sign in failed. Please try again.");
                }
            }
        } else {
            console.log("[Apple Sign In] Falling back to OAuth");
            // Fallback to web OAuth when native module unavailable
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "apple",
                options: {
                    redirectTo: Linking.createURL("/(auth)/login"),
                },
            });

            if (error) {
                Alert.alert("Error", getAuthError(error));
            }
        }
    };

    const handleGoogleSignIn = async () => {
        console.log("[Google Sign In] Starting, isGoogleAuthAvailable:", isGoogleAuthAvailable, "GoogleSignin:", !!GoogleSignin);

        if (isGoogleAuthAvailable && GoogleSignin) {
            try {
                console.log("[Google Sign In] Checking Play Services...");
                await GoogleSignin.hasPlayServices();

                console.log("[Google Sign In] Calling signIn...");
                const response = await GoogleSignin.signIn();
                console.log("[Google Sign In] Got response, type:", response.type);

                if (response.type === "success" && response.data.idToken) {
                    console.log("[Google Sign In] Got idToken, signing in with Supabase...");
                    const { error } = await supabase.auth.signInWithIdToken({
                        provider: "google",
                        token: response.data.idToken,
                    });

                    if (error) {
                        console.log("[Google Sign In] Supabase error:", error.message);
                        Alert.alert("Error", getAuthError(error));
                    } else {
                        Events.signIn("google");
                    }
                } else if (response.type === "cancelled") {
                    console.log("[Google Sign In] User cancelled");
                } else {
                    Alert.alert("Error", "No identity token received from Google");
                }
            } catch (e: any) {
                console.log("[Google Sign In] Caught error:", e.code, e.message);
                Alert.alert("Error", "Google sign in failed. Please try again.");
            }
        }
    };

    const handleGuestSignIn = async () => {
        clearError();
        setIsGuestLoading(true);
        const { error: authError } = await supabase.auth.signInAnonymously();
        setIsGuestLoading(false);

        if (authError) {
            showError(getAuthError(authError));
            return;
        }

        Events.signIn("guest");
    };
 
    if (isMagicLinkSent) {
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

    // Email verification pending screen
    if (pendingVerification) {
        return (
            <GradientBackground showAccent>
                <View style={styles.centeredContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.centeredContent}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="mail-unread" size={48} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Verify your email</Text>
                        <Text style={styles.subtitle}>
                            We sent a verification link to{'\n'}
                            <Text style={styles.emailHighlight}>{pendingVerification.email}</Text>
                        </Text>
                        <Text style={styles.verificationHint}>
                            Click the link in your email to verify your account, then tap the button below.
                        </Text>
                        <GlassButton
                            onPress={checkVerificationStatus}
                            loading={isCheckingVerification}
                            disabled={isCheckingVerification}
                            style={{ marginTop: spacing.lg }}
                        >
                            I've verified my email
                        </GlassButton>
                        <GlassButton
                            variant="secondary"
                            onPress={resendVerificationEmail}
                            loading={isResendingEmail}
                            disabled={isResendingEmail || resendCooldown > 0}
                            style={{ marginTop: spacing.sm }}
                        >
                            {resendCooldown > 0
                                ? `Resend email (${resendCooldown}s)`
                                : "Resend verification email"}
                        </GlassButton>
                        <GlassButton
                            variant="ghost"
                            onPress={() => {
                                setPendingVerification(null);
                                setEmail(pendingVerification.email);
                                setPassword("");
                                setResendCooldown(0);
                            }}
                            style={{ marginTop: spacing.sm }}
                        >
                            Use a different email
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
                            <Image
                                source={require("../../assets/logo.png")}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
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
                                        <>
                                            <GlassInput
                                                placeholder="Enter your password"
                                                value={password}
                                                onChangeText={(text) => { clearError(); setPassword(text); }}
                                                secureTextEntry
                                                autoCapitalize="none"
                                                icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />}
                                            />
                                            {!isSignUp && (
                                                <TouchableOpacity
                                                    style={styles.forgotPassword}
                                                    onPress={() => router.push("/(auth)/forgot-password")}
                                                >
                                                    <Text style={styles.forgotPasswordText}>
                                                        Forgot password?
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </>
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

                        {/* Social Sign In - iOS only */}
                        {Platform.OS === "ios" && (
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
                                    {isAppleAuthAvailable && AppleAuthentication ? (
                                        <AppleAuthentication.AppleAuthenticationButton
                                            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                                            cornerRadius={12}
                                            style={styles.appleButton}
                                            onPress={handleAppleSignIn}
                                        />
                                    ) : (
                                        <GlassButton
                                            variant="secondary"
                                            onPress={handleAppleSignIn}
                                            icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
                                            style={styles.socialButton}
                                        >
                                            Apple
                                        </GlassButton>
                                    )}
                                </View>
                            </Animated.View>
                        )}

                        {/* Social Sign In - Android (Google) */}
                        {Platform.OS === "android" && isGoogleAuthAvailable && (
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
                                        fullWidth
                                    >
                                        Continue with Google
                                    </GlassButton>
                                </View>
                            </Animated.View>
                        )}

                        <Animated.View
                            entering={FadeInDown.delay(400).duration(600).springify()}
                            style={styles.guestContainer}
                        >
                            <GlassButton
                                variant="ghost"
                                onPress={handleGuestSignIn}
                                loading={isGuestLoading}
                                disabled={isGuestLoading}
                                icon={<Ionicons name="person-outline" size={20} color={colors.primary} />}
                                fullWidth
                            >
                                Continue without Login
                            </GlassButton>
                            <Text style={styles.guestHint}>Save your account anytime in Settings.</Text>
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
    brandContainer: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    logoImage: {
        width: 100,
        height: 100,
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
    verificationHint: {
        ...typography.subhead,
        color: colors.textSecondary,
        textAlign: "center",
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
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
        backgroundColor: colors.background, // Flat background
        borderRadius: radius.md,
        padding: 4,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
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
    forgotPassword: {
        alignSelf: "center",
        marginTop: -spacing.xs,
        marginBottom: spacing.xs,
    },
    forgotPasswordText: {
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
    appleButton: {
        flex: 1,
        height: 48,
    },
    guestContainer: {
        marginTop: spacing.lg,
        alignItems: "center",
        gap: spacing.sm,
    },
    guestHint: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: "center",
    },
});
