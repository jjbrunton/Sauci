import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { Redirect } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../../src/lib/supabase";
import { useAuthStore } from "../../src/store";


type AuthMode = "magic-link" | "password";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
    const [authMode, setAuthMode] = useState<AuthMode>("magic-link");
    const [isSignUp, setIsSignUp] = useState(false);
    const { isAuthenticated } = useAuthStore();

    // Use declarative Redirect instead of imperative router.replace()
    // This ensures navigation only happens after the Root Layout is mounted
    if (isAuthenticated) {
        return <Redirect href="/" />;
    }

    const handleMagicLink = async () => {
        if (!email.trim()) {
            Alert.alert("Error", "Please enter your email");
            return;
        }

        setIsLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: Linking.createURL("/(auth)/login"),
            },
        });

        setIsLoading(false);

        if (error) {
            Alert.alert("Error", error.message);
        } else {
            setIsMagicLinkSent(true);
        }
    };

    const handlePasswordAuth = async () => {
        if (!email.trim()) {
            Alert.alert("Error", "Please enter your email");
            return;
        }
        if (!password) {
            Alert.alert("Error", "Please enter your password");
            return;
        }
        if (isSignUp && password.length < 6) {
            Alert.alert("Error", "Password must be at least 6 characters");
            return;
        }

        setIsLoading(true);

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
            });

            setIsLoading(false);

            if (error) {
                Alert.alert("Error", error.message);
            } else {
                Alert.alert(
                    "Check your email",
                    "We sent you a confirmation link to verify your email address.",
                    [{ text: "OK" }]
                );
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            setIsLoading(false);

            if (error) {
                Alert.alert("Error", error.message);
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
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.emoji}>✉️</Text>
                    <Text style={styles.title}>Check your email</Text>
                    <Text style={styles.subtitle}>
                        We sent a magic link to {email}
                    </Text>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setIsMagicLinkSent(false)}
                    >
                        <Text style={styles.secondaryButtonText}>Try a different email</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.content}>
                    <Text style={styles.emoji}>💕</Text>
                    <Text style={styles.title}>Sauci</Text>
                    <Text style={styles.subtitle}>
                        Explore intimacy together
                    </Text>

                    {/* Auth Mode Toggle */}
                    <View style={styles.modeToggleContainer}>
                        <TouchableOpacity
                            style={[
                                styles.modeToggle,
                                authMode === "magic-link" && styles.modeToggleActive,
                            ]}
                            onPress={() => setAuthMode("magic-link")}
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

                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#666"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        {authMode === "password" && (
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                placeholderTextColor="#666"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                        )}

                        {authMode === "magic-link" ? (
                            <TouchableOpacity
                                style={[styles.button, isLoading && styles.buttonDisabled]}
                                onPress={handleMagicLink}
                                disabled={isLoading}
                            >
                                <Text style={styles.buttonText}>
                                    {isLoading ? "Sending..." : "Continue with Magic Link"}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, isLoading && styles.buttonDisabled]}
                                    onPress={handlePasswordAuth}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.buttonText}>
                                        {isLoading
                                            ? isSignUp
                                                ? "Creating Account..."
                                                : "Signing In..."
                                            : isSignUp
                                                ? "Create Account"
                                                : "Sign In"}
                                    </Text>
                                </TouchableOpacity>
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

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={handleGoogleSignIn}
                        >
                            <Text style={styles.socialButtonText}>Continue with Google</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={handleAppleSignIn}
                        >
                            <Text style={styles.socialButtonText}>Continue with Apple</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a2e",
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 80,
        alignItems: "center",
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: "#888",
        marginBottom: 48,
        textAlign: "center",
    },
    form: {
        width: "100%",
    },
    input: {
        backgroundColor: "#16213e",
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: "#fff",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    button: {
        backgroundColor: "#e94560",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#333",
    },
    dividerText: {
        color: "#666",
        paddingHorizontal: 16,
    },
    socialButton: {
        backgroundColor: "#16213e",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    socialButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "500",
    },
    secondaryButton: {
        marginTop: 24,
    },
    secondaryButtonText: {
        color: "#e94560",
        fontSize: 16,
    },
    scrollContent: {
        flexGrow: 1,
    },
    modeToggleContainer: {
        flexDirection: "row",
        backgroundColor: "#16213e",
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
        width: "100%",
    },
    modeToggle: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    modeToggleActive: {
        backgroundColor: "#e94560",
    },
    modeToggleText: {
        color: "#666",
        fontSize: 14,
        fontWeight: "500",
    },
    modeToggleTextActive: {
        color: "#fff",
    },
    toggleSignUp: {
        marginTop: 16,
        alignItems: "center",
    },
    toggleSignUpText: {
        color: "#e94560",
        fontSize: 14,
    },
});

