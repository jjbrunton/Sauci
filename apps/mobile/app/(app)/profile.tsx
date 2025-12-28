import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform } from "react-native";
import { useAuthStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "../../src/lib/supabase";
import { router } from "expo-router";
import { GradientBackground, GlassCard, GlassButton } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography, shadows } from "../../src/theme";

export default function ProfileScreen() {
    const { user, partner, signOut, fetchCouple } = useAuthStore();

    const handleUnpair = async () => {
        Alert.alert(
            "Unpair Partner",
            "Are you sure you want to unpair? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unpair",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await supabase.functions.invoke("manage-couple", {
                                method: "DELETE",
                            });
                            await fetchCouple();
                        } catch (error) {
                            Alert.alert("Error", "Failed to unpair");
                        }
                    },
                },
            ]
        );
    };

    const handleSignOut = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: signOut,
                },
            ]
        );
    };

    return (
        <GradientBackground>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(500)}
                    style={styles.header}
                >
                    <Text style={styles.title}>Profile</Text>
                </Animated.View>

                {/* Profile Card */}
                <Animated.View entering={FadeInDown.delay(200).duration(500)}>
                    <GlassCard style={styles.profileCard} variant="elevated">
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.avatarContainer}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {user?.name?.[0]?.toUpperCase() || "U"}
                                </Text>
                            </View>
                        </LinearGradient>
                        <Text style={styles.name}>{user?.name || "User"}</Text>
                        <Text style={styles.email}>{user?.email}</Text>
                    </GlassCard>
                </Animated.View>

                {/* Relationship Section */}
                <Animated.View entering={FadeInDown.delay(300).duration(500)}>
                    <Text style={styles.sectionTitle}>Relationship</Text>
                    <GlassCard>
                        {partner ? (
                            <View style={styles.row}>
                                <View style={styles.rowLeft}>
                                    <View style={styles.rowIconContainer}>
                                        <Ionicons name="heart" size={20} color={colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={styles.rowLabel}>Paired with</Text>
                                        <Text style={styles.rowValue}>
                                            {partner.name || partner.email || 'your partner'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={handleUnpair}
                                    style={styles.rowAction}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="unlink-outline" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.row}
                                onPress={() => router.push("/(app)/pairing")}
                                activeOpacity={0.7}
                            >
                                <View style={styles.rowLeft}>
                                    <View style={[styles.rowIconContainer, styles.rowIconInactive]}>
                                        <Ionicons name="heart-outline" size={20} color={colors.textTertiary} />
                                    </View>
                                    <View>
                                        <Text style={styles.rowLabel}>Not paired yet</Text>
                                        <Text style={styles.rowValueMuted}>Tap to connect with your partner</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </GlassCard>
                </Animated.View>

                {/* Settings Section */}
                <Animated.View entering={FadeInDown.delay(400).duration(500)}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <GlassCard noPadding>
                        <TouchableOpacity
                            style={[styles.menuRow, styles.menuRowDanger]}
                            onPress={handleSignOut}
                            activeOpacity={0.7}
                        >
                            <View style={styles.rowLeft}>
                                <View style={[styles.rowIconContainer, styles.rowIconDanger]}>
                                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                                </View>
                                <Text style={styles.rowLabelDanger}>Sign Out</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.error} />
                        </TouchableOpacity>
                    </GlassCard>
                </Animated.View>

                {/* Version */}
                <Animated.View
                    entering={FadeInDown.delay(500).duration(500)}
                    style={styles.versionContainer}
                >
                    <Text style={styles.version}>Sauci v1.0.0</Text>
                    <Text style={styles.versionSub}>Made with love</Text>
                </Animated.View>

                {/* Bottom spacing for tab bar */}
                <View style={styles.bottomSpacer} />
            </ScrollView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    title: {
        ...typography.title1,
        color: colors.text,
    },
    profileCard: {
        marginHorizontal: spacing.lg,
        alignItems: "center",
        paddingVertical: spacing.xl,
        marginBottom: spacing.lg,
    },
    avatarContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
        ...shadows.lg,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        fontSize: 32,
        fontWeight: "bold",
        color: colors.text,
    },
    name: {
        ...typography.title2,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    email: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    sectionTitle: {
        ...typography.caption1,
        color: colors.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: spacing.sm,
        marginLeft: spacing.lg + spacing.xs,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
    },
    rowLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    rowIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    rowIconInactive: {
        backgroundColor: colors.glass.background,
    },
    rowIconDanger: {
        backgroundColor: colors.errorLight,
    },
    rowLabel: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    rowValue: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
    },
    rowValueMuted: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    rowLabelDanger: {
        ...typography.body,
        color: colors.error,
        fontWeight: "500",
    },
    rowAction: {
        padding: spacing.sm,
    },
    menuRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
    },
    menuRowDanger: {
        borderRadius: radius.lg,
    },
    versionContainer: {
        alignItems: "center",
        marginTop: spacing.xl,
    },
    version: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    versionSub: {
        ...typography.caption2,
        color: colors.textTertiary,
        marginTop: spacing.xs,
    },
    bottomSpacer: {
        height: spacing.lg,
    },
});
