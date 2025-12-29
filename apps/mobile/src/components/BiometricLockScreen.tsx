import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, spacing, radius, typography, shadows, blur } from "../theme";
import { authenticateWithBiometric, getBiometricType } from "../lib/biometricAuth";

interface BiometricLockScreenProps {
    visible: boolean;
    onUnlock: () => void;
}

export function BiometricLockScreen({ visible, onUnlock }: BiometricLockScreenProps) {
    const [biometricType, setBiometricType] = useState<string>("Face ID");
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    useEffect(() => {
        const loadBiometricType = async () => {
            const type = await getBiometricType();
            setBiometricType(type);
        };
        loadBiometricType();
    }, []);

    useEffect(() => {
        if (visible) {
            // Auto-trigger authentication when the lock screen appears
            handleAuthenticate();
        }
    }, [visible]);

    const handleAuthenticate = async () => {
        if (isAuthenticating) return;

        setIsAuthenticating(true);
        try {
            const success = await authenticateWithBiometric();
            if (success) {
                onUnlock();
            }
        } finally {
            setIsAuthenticating(false);
        }
    };

    const getBiometricIcon = () => {
        if (biometricType === "Face ID" || biometricType === "Face Recognition") {
            return "scan-outline";
        }
        return "finger-print-outline";
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.container}>
                {Platform.OS === "ios" ? (
                    <BlurView intensity={blur.heavy} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.androidBackground]} />
                )}

                <View style={styles.content}>
                    {/* Logo/Icon */}
                    <View style={styles.logoContainer}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoGradient}
                        >
                            <Ionicons name="heart" size={48} color={colors.text} />
                        </LinearGradient>
                    </View>

                    <Text style={styles.title}>Sauci is Locked</Text>
                    <Text style={styles.subtitle}>
                        Use {biometricType} to unlock
                    </Text>

                    {/* Unlock Button */}
                    <TouchableOpacity
                        style={styles.unlockButton}
                        onPress={handleAuthenticate}
                        activeOpacity={0.7}
                        disabled={isAuthenticating}
                    >
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.unlockButtonGradient}
                        >
                            <Ionicons
                                name={getBiometricIcon()}
                                size={28}
                                color={colors.text}
                            />
                            <Text style={styles.unlockButtonText}>
                                {isAuthenticating ? "Authenticating..." : `Unlock with ${biometricType}`}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    androidBackground: {
        backgroundColor: "rgba(13, 13, 26, 0.95)",
    },
    content: {
        alignItems: "center",
        paddingHorizontal: spacing.xl,
    },
    logoContainer: {
        marginBottom: spacing.xl,
    },
    logoGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.lg,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xl,
    },
    unlockButton: {
        borderRadius: radius.lg,
        overflow: "hidden",
        ...shadows.lg,
    },
    unlockButtonGradient: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
    },
    unlockButtonText: {
        ...typography.headline,
        color: colors.text,
    },
});
