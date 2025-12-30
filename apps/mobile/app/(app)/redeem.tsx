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
import { router } from "expo-router";
import Animated, {
    FadeInDown,
    FadeInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground, GlassCard, GlassButton, GlassInput } from "../../src/components/ui";
import { colors, spacing, radius, typography } from "../../src/theme";

export default function RedeemScreen() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isRedeemed, setIsRedeemed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const showError = (message: string) => {
        setError(message);
        if (Platform.OS !== 'web') {
            Alert.alert("Error", message);
        }
    };

    const clearError = () => setError(null);

    const handleRedeem = async () => {
        clearError();

        if (!email.trim()) {
            showError("Please enter your email address");
            return;
        }

        if (!code.trim()) {
            showError("Please enter your redemption code");
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            showError("Please enter a valid email address");
            return;
        }

        setIsLoading(true);

        // TODO: Wire up to backend
        // For now, just simulate a delay and show success
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsLoading(false);
        setIsRedeemed(true);
    };

    // Success screen
    if (isRedeemed) {
        return (
            <GradientBackground showAccent>
                <View style={styles.centeredContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.centeredContent}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                        </View>
                        <Text style={styles.title}>Code Redeemed!</Text>
                        <Text style={styles.subtitle}>
                            Your premium access has been activated for{'\n'}
                            <Text style={styles.emailHighlight}>{email}</Text>
                        </Text>
                        <Text style={styles.hint}>
                            Enjoy all premium question packs and features.
                        </Text>
                        <GlassButton
                            onPress={() => router.back()}
                            style={{ marginTop: spacing.lg }}
                        >
                            Back to Profile
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
                                <Ionicons name="gift" size={40} color={colors.primary} />
                            </View>
                            <Text style={styles.title}>Redeem Premium</Text>
                            <Text style={styles.subtitle}>
                                Enter your email and redemption code to unlock premium features
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
                                        icon={<Ionicons name="mail-outline" size={20} color={colors.textTertiary} />}
                                    />

                                    <GlassInput
                                        placeholder="Enter redemption code"
                                        value={code}
                                        onChangeText={(text) => { clearError(); setCode(text.toUpperCase()); }}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        icon={<Ionicons name="key-outline" size={20} color={colors.textTertiary} />}
                                    />

                                    <GlassButton
                                        onPress={handleRedeem}
                                        loading={isLoading}
                                        disabled={isLoading}
                                        fullWidth
                                    >
                                        Redeem Code
                                    </GlassButton>
                                </View>
                            </GlassCard>
                        </Animated.View>

                        {/* Info Text */}
                        <Animated.View
                            entering={FadeInDown.delay(250).duration(600).springify()}
                            style={styles.infoContainer}
                        >
                            <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                            <Text style={styles.infoText}>
                                Redemption codes are provided through promotions and giveaways. Each code can only be used once.
                            </Text>
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
    infoContainer: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: spacing.sm,
        gap: spacing.sm,
    },
    infoText: {
        ...typography.caption1,
        color: colors.textTertiary,
        flex: 1,
        lineHeight: 18,
    },
});
