import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, useWindowDimensions, TextInput, Modal, ActivityIndicator, Linking, Switch } from "react-native";
import { useState, useMemo } from "react";
import { useAuthStore, useMatchStore, useMessageStore, usePacksStore, useSubscriptionStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "../../src/lib/supabase";
import { router } from "expo-router";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { FeedbackModal } from "../../src/components/FeedbackModal";
import { Paywall } from "../../src/components/Paywall";
import { colors, gradients, spacing, radius, typography, shadows } from "../../src/theme";

const MAX_CONTENT_WIDTH = 500;

export default function ProfileScreen() {
    const { user, partner, couple, signOut, fetchCouple, fetchUser } = useAuthStore();
    const { clearMatches } = useMatchStore();
    const { clearMessages } = useMessageStore();
    const { clearPacks, fetchPacks } = usePacksStore();
    const { subscription, restorePurchases, isPurchasing } = useSubscriptionStore();
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showExplicit, setShowExplicit] = useState(user?.show_explicit_content ?? false);
    const [isUpdatingExplicit, setIsUpdatingExplicit] = useState(false);

    // Check if user or partner has premium access
    const hasPremiumAccess = useMemo(() => {
        return user?.is_premium || partner?.is_premium || subscription.isProUser;
    }, [user?.is_premium, partner?.is_premium, subscription.isProUser]);

    // Check if it's the user's own subscription (vs partner's)
    const isOwnSubscription = user?.is_premium && subscription.isProUser;

    // Format expiration date
    const formatExpirationDate = (date: Date | null) => {
        if (!date) return "Never";
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const handleRestorePurchases = async () => {
        const restored = await restorePurchases();
        if (restored) {
            Alert.alert("Success", "Your purchases have been restored!");
        } else {
            Alert.alert("No Purchases Found", "No previous purchases found to restore.");
        }
    };

    const handleExplicitToggle = async (value: boolean) => {
        if (!user?.id) return;

        setShowExplicit(value);
        setIsUpdatingExplicit(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    show_explicit_content: value,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            // Refresh user data and packs to reflect the change
            await fetchUser();
            await fetchPacks();
        } catch (error) {
            // Revert on error
            setShowExplicit(!value);
            Alert.alert("Error", "Failed to update preference. Please try again.");
        } finally {
            setIsUpdatingExplicit(false);
        }
    };

    const handleManageSubscription = () => {
        Linking.openURL("https://apps.apple.com/account/subscriptions");
    };

    const handleDeleteRelationship = async () => {
        if (deleteConfirmText !== "DELETE") return;

        setIsDeleting(true);
        try {
            const { error } = await supabase.functions.invoke("delete-relationship", {
                method: "DELETE",
            });

            if (error) throw error;

            // Clear local stores
            clearMatches();
            clearMessages();
            clearPacks();

            // Refresh user data (will also clear couple/partner since couple_id is now null)
            await useAuthStore.getState().fetchUser();

            setShowDeleteModal(false);
            setDeleteConfirmText("");
            Alert.alert("Success", "All relationship data has been deleted.");
        } catch (error) {
            Alert.alert("Error", "Failed to delete relationship data. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

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
                contentContainerStyle={[
                    styles.contentContainer,
                    isWideScreen && styles.contentContainerWide,
                ]}
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
                <Animated.View
                    entering={FadeInDown.delay(200).duration(500)}
                    style={styles.profileSection}
                >
                    <GlassCard variant="elevated">
                        <View style={styles.profileContent}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.avatarGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.avatarInner}>
                                    <Text style={styles.avatarText}>
                                        {user?.name?.[0]?.toUpperCase() || "U"}
                                    </Text>
                                </View>
                            </LinearGradient>
                            <View style={styles.profileInfo}>
                                <Text style={styles.name}>{user?.name || "User"}</Text>
                                <Text style={styles.email}>{user?.email}</Text>
                            </View>
                        </View>
                    </GlassCard>
                </Animated.View>

                {/* Partner Section */}
                <Animated.View
                    entering={FadeInDown.delay(300).duration(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Partner</Text>
                    <GlassCard>
                        {partner ? (
                            <View style={styles.rowContainer}>
                                <View style={styles.rowLeft}>
                                    <LinearGradient
                                        colors={gradients.primary as [string, string]}
                                        style={styles.partnerIconGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons name="heart" size={20} color={colors.text} />
                                    </LinearGradient>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowValue}>
                                            {partner.name || partner.email || 'Your partner'}
                                        </Text>
                                        <Text style={styles.rowLabel}>Connected</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={handleUnpair}
                                    style={styles.unlinkButton}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="unlink-outline" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        ) : couple ? (
                            <TouchableOpacity
                                style={styles.rowContainer}
                                onPress={() => router.push("/(app)/pairing")}
                                activeOpacity={0.7}
                            >
                                <View style={styles.rowLeft}>
                                    <LinearGradient
                                        colors={gradients.primary as [string, string]}
                                        style={styles.partnerIconGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons name="hourglass-outline" size={20} color={colors.text} />
                                    </LinearGradient>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowValue}>Waiting for partner</Text>
                                        <Text style={styles.rowLabel}>Tap to view invite code</Text>
                                    </View>
                                </View>
                                <View style={styles.chevronContainer}>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.rowContainer}
                                onPress={() => router.push("/(app)/pairing")}
                                activeOpacity={0.7}
                            >
                                <View style={styles.rowLeft}>
                                    <View style={styles.emptyPartnerIcon}>
                                        <Ionicons name="heart-outline" size={20} color={colors.textTertiary} />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowValueMuted}>Not paired yet</Text>
                                        <Text style={styles.rowLabel}>Tap to connect</Text>
                                    </View>
                                </View>
                                <View style={styles.chevronContainer}>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                </View>
                            </TouchableOpacity>
                        )}
                    </GlassCard>
                </Animated.View>

                {/* Subscription Section */}
                <Animated.View
                    entering={FadeInDown.delay(350).duration(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Subscription</Text>
                    <GlassCard>
                        {hasPremiumAccess ? (
                            <View style={styles.rowContainer}>
                                <View style={styles.rowLeft}>
                                    <LinearGradient
                                        colors={gradients.primary as [string, string]}
                                        style={styles.partnerIconGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons name="star" size={20} color={colors.text} />
                                    </LinearGradient>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowValue}>Pro Member</Text>
                                        <Text style={styles.rowLabel}>
                                            {isOwnSubscription
                                                ? `Renews ${formatExpirationDate(subscription.expirationDate)}`
                                                : "Via partner's subscription"
                                            }
                                        </Text>
                                    </View>
                                </View>
                                {isOwnSubscription && (
                                    <TouchableOpacity
                                        style={styles.manageButton}
                                        onPress={handleManageSubscription}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.manageButtonText}>Manage</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.rowContainer}
                                onPress={() => setShowPaywall(true)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.rowLeft}>
                                    <View style={styles.emptyPartnerIcon}>
                                        <Ionicons name="star-outline" size={20} color={colors.textTertiary} />
                                    </View>
                                    <View style={styles.rowTextContainer}>
                                        <Text style={styles.rowValueMuted}>Free Plan</Text>
                                        <Text style={styles.rowLabel}>Upgrade to unlock all packs</Text>
                                    </View>
                                </View>
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.upgradeButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.upgradeButtonText}>Upgrade</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </GlassCard>

                    {/* Restore Purchases Link */}
                    {!hasPremiumAccess && (
                        <TouchableOpacity
                            style={styles.restoreLink}
                            onPress={handleRestorePurchases}
                            disabled={isPurchasing}
                        >
                            <Text style={styles.restoreLinkText}>
                                {isPurchasing ? "Restoring..." : "Restore Purchases"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* Preferences Section */}
                <Animated.View
                    entering={FadeInDown.delay(375).duration(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <GlassCard>
                        <View style={styles.rowContainer}>
                            <View style={styles.rowLeft}>
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.partnerIconGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="flame" size={20} color={colors.text} />
                                </LinearGradient>
                                <View style={styles.rowTextContainer}>
                                    <Text style={styles.rowValue}>Explicit Content</Text>
                                    <Text style={styles.rowLabel}>Show 18+ question packs</Text>
                                </View>
                            </View>
                            <Switch
                                value={showExplicit}
                                onValueChange={handleExplicitToggle}
                                disabled={isUpdatingExplicit}
                                trackColor={{ false: colors.glass.border, true: colors.primaryLight }}
                                thumbColor={showExplicit ? colors.primary : colors.textTertiary}
                                ios_backgroundColor={colors.glass.border}
                            />
                        </View>
                    </GlassCard>
                </Animated.View>

                {/* Account Section */}
                <Animated.View
                    entering={FadeInDown.delay(425).duration(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Account</Text>
                    <GlassCard>
                        <TouchableOpacity
                            style={styles.signOutRow}
                            onPress={handleSignOut}
                            activeOpacity={0.7}
                        >
                            <View style={styles.rowLeft}>
                                <View style={styles.signOutIcon}>
                                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                                </View>
                                <Text style={styles.signOutText}>Sign Out</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.error} />
                        </TouchableOpacity>
                    </GlassCard>
                </Animated.View>

                {/* Support Section */}
                <Animated.View
                    entering={FadeInDown.delay(475).duration(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Support</Text>
                    <GlassCard>
                        <TouchableOpacity
                            style={styles.rowContainer}
                            onPress={() => setShowFeedbackModal(true)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.rowLeft}>
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.partnerIconGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.text} />
                                </LinearGradient>
                                <View style={styles.rowTextContainer}>
                                    <Text style={styles.rowValue}>Send Feedback</Text>
                                    <Text style={styles.rowLabel}>Report bugs or request features</Text>
                                </View>
                            </View>
                            <View style={styles.chevronContainer}>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </View>
                        </TouchableOpacity>
                    </GlassCard>
                </Animated.View>

                {/* Danger Zone - Only show if in a couple */}
                {couple && (
                    <Animated.View
                        entering={FadeInDown.delay(525).duration(500)}
                        style={styles.section}
                    >
                        <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
                        <GlassCard style={styles.dangerCard}>
                            <View style={styles.dangerContent}>
                                <View style={styles.dangerInfo}>
                                    <View style={styles.dangerIconContainer}>
                                        <Ionicons name="warning" size={20} color={colors.error} />
                                    </View>
                                    <View style={styles.dangerTextContainer}>
                                        <Text style={styles.dangerTitle}>Delete All Data</Text>
                                        <Text style={styles.dangerDescription}>
                                            Permanently delete your relationship including all matches, chats, and shared photos.
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.dangerButton}
                                    onPress={() => setShowDeleteModal(true)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                                    <Text style={styles.dangerButtonText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </GlassCard>
                    </Animated.View>
                )}

                {/* Version */}
                <Animated.View
                    entering={FadeInDown.delay(couple ? 575 : 525).duration(500)}
                    style={styles.versionContainer}
                >
                    <View style={styles.versionBadge}>
                        <Ionicons name="heart" size={12} color={colors.primary} />
                        <Text style={styles.version}>Sauci v1.0.0</Text>
                    </View>
                </Animated.View>

                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Feedback Modal */}
            <FeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
            />

            {/* Paywall Modal */}
            <Paywall
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconContainer}>
                                <Ionicons name="warning" size={32} color={colors.error} />
                            </View>
                            <Text style={styles.modalTitle}>Delete All Data?</Text>
                        </View>

                        <Text style={styles.modalDescription}>
                            This action cannot be undone. This will permanently delete:
                        </Text>

                        <View style={styles.deleteList}>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="heart-dislike" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>Your couple connection</Text>
                            </View>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="checkmark-circle" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>All matches and responses</Text>
                            </View>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="chatbubbles" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>All chat messages</Text>
                            </View>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="images" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>All shared photos</Text>
                            </View>
                        </View>

                        <Text style={styles.confirmLabel}>
                            Type <Text style={styles.confirmKeyword}>DELETE</Text> to confirm:
                        </Text>

                        <TextInput
                            style={styles.confirmInput}
                            value={deleteConfirmText}
                            onChangeText={setDeleteConfirmText}
                            placeholder="Type DELETE"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            editable={!isDeleting}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirmText("");
                                }}
                                disabled={isDeleting}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.confirmDeleteButton,
                                    deleteConfirmText !== "DELETE" && styles.confirmDeleteButtonDisabled,
                                ]}
                                onPress={handleDeleteRelationship}
                                disabled={deleteConfirmText !== "DELETE" || isDeleting}
                                activeOpacity={0.7}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <>
                                        <Ionicons name="trash" size={16} color={colors.text} />
                                        <Text style={styles.confirmDeleteButtonText}>Delete</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    contentContainerWide: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    title: {
        ...typography.title1,
        color: colors.text,
    },
    profileSection: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    profileContent: {
        alignItems: "center",
        paddingVertical: spacing.lg,
    },
    avatarGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.lg,
    },
    avatarInner: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        fontSize: 36,
        fontWeight: "bold",
        color: colors.text,
    },
    profileInfo: {
        alignItems: "center",
        marginTop: spacing.lg,
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
    section: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        ...typography.caption1,
        color: colors.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    rowContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    rowLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    partnerIconGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyPartnerIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
    },
    rowTextContainer: {
        marginLeft: spacing.md,
        flex: 1,
    },
    rowValue: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
    },
    rowValueMuted: {
        ...typography.body,
        color: colors.textSecondary,
    },
    rowLabel: {
        ...typography.caption1,
        color: colors.textTertiary,
        marginTop: 2,
    },
    unlinkButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
    },
    chevronContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
    },
    signOutRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    signOutIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.errorLight,
        justifyContent: "center",
        alignItems: "center",
    },
    signOutText: {
        ...typography.body,
        color: colors.error,
        fontWeight: "600",
        marginLeft: spacing.md,
    },
    // Subscription styles
    manageButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    manageButtonText: {
        ...typography.subhead,
        color: colors.primary,
        fontWeight: "600",
    },
    upgradeButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
    },
    upgradeButtonText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "600",
    },
    restoreLink: {
        alignItems: "center",
        marginTop: spacing.sm,
        padding: spacing.sm,
    },
    restoreLinkText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    versionContainer: {
        alignItems: "center",
        marginTop: spacing.lg,
    },
    versionBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.glass.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.xs,
    },
    version: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    bottomSpacer: {
        height: spacing.lg,
    },
    // Danger Zone styles
    dangerSectionTitle: {
        ...typography.caption1,
        color: colors.error,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    dangerCard: {
        borderColor: 'rgba(231, 76, 60, 0.3)',
        borderWidth: 1,
    },
    dangerContent: {
        gap: spacing.md,
    },
    dangerInfo: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    dangerIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.errorLight,
        justifyContent: "center",
        alignItems: "center",
    },
    dangerTextContainer: {
        flex: 1,
        marginLeft: spacing.md,
    },
    dangerTitle: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    dangerDescription: {
        ...typography.subhead,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    dangerButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.errorLight,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.3)',
        gap: spacing.xs,
        alignSelf: "flex-end",
    },
    dangerButtonText: {
        ...typography.subhead,
        color: colors.error,
        fontWeight: "600",
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.lg,
        width: "100%",
        maxWidth: 400,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    modalHeader: {
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.errorLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    modalTitle: {
        ...typography.title2,
        color: colors.text,
        textAlign: "center",
    },
    modalDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    deleteList: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    deleteListItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    deleteListText: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    confirmLabel: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    confirmKeyword: {
        color: colors.error,
        fontWeight: "bold",
    },
    confirmInput: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.md,
        ...typography.body,
        color: colors.text,
        marginBottom: spacing.lg,
    },
    modalButtons: {
        flexDirection: "row",
        gap: spacing.md,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: colors.glass.background,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.textSecondary,
        fontWeight: "600",
    },
    confirmDeleteButton: {
        flex: 1,
        backgroundColor: colors.error,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.xs,
    },
    confirmDeleteButtonDisabled: {
        backgroundColor: colors.glass.background,
        opacity: 0.5,
    },
    confirmDeleteButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
    },
});
