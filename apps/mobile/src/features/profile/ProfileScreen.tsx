import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Platform, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { GradientBackground } from '../../components/ui';
import { Paywall } from '../../components/paywall';
import { colors, featureColors, spacing, typography, radius } from '../../theme';
import { useAuthStore, useSubscriptionStore } from '../../store';
import { resetSwipeTutorial } from '../../lib/swipeTutorialSeen';
import { resetMatchesTutorial } from '../../lib/matchesTutorialSeen';
import { supabase } from '../../lib/supabase';

// Components
import { SettingsSection, MenuItem, SubscriptionCard } from './components';

// Hooks
import { useProfileSettings } from './hooks';

const MAX_CONTENT_WIDTH = 500;
const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

export function ProfileScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;

    const { user, partner, fetchUser, isAnonymous } = useAuthStore();
    const { subscription } = useSubscriptionStore();
    const settings = useProfileSettings();

    // Paywall state
    const [showPaywall, setShowPaywall] = useState(false);

    // Derived state
    const isOwnSubscription = subscription.isProUser || user?.is_premium;
    const hasPremiumAccess = user?.is_premium || partner?.is_premium || subscription.isProUser;

    const formatExpirationDate = (date: Date | null | string) => {
        if (!date) return "Never";
        const d = new Date(date);
        return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    // Version info
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const buildNumber = Platform.select({
        ios: Constants.expoConfig?.ios?.buildNumber,
        android: Constants.expoConfig?.android?.versionCode?.toString(),
        default: undefined,
    });
    const versionString = buildNumber ? `v${version} (${buildNumber})` : `v${version}`;

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
                {/* Header with user info (compact) */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(500)}
                    style={styles.header}
                >
                    <Text style={styles.headerLabel}>YOUR SAUCI</Text>
                    <Text style={styles.title}>Settings</Text>
                    <View style={styles.separator}>
                        <View style={styles.separatorLine} />
                        <View style={styles.separatorDiamond} />
                        <View style={styles.separatorLine} />
                    </View>
                </Animated.View>

                {/* Compact Profile Preview */}
                <Animated.View
                    entering={FadeInDown.delay(150).duration(500)}
                    style={styles.profilePreview}
                >
                    <TouchableOpacity
                        style={styles.profilePreviewContent}
                        onPress={() => router.push('/(app)/settings/profile')}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={ACCENT_GRADIENT}
                            style={styles.avatarGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {user?.avatar_url ? (
                                <Image
                                    source={{ uri: user.avatar_url }}
                                    style={styles.avatar}
                                    cachePolicy="disk"
                                    transition={200}
                                />
                            ) : (
                                <View style={styles.avatarInner}>
                                    <Text style={styles.avatarText}>
                                        {user?.name?.[0]?.toUpperCase() || "U"}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                        <View style={styles.profileInfo}>
                            <Text style={styles.userName}>{user?.name || "User"}</Text>
                            <Text style={styles.userEmail}>
                                {isAnonymous ? "Unsaved account" : (user?.email || "")}
                            </Text>
                        </View>
                        <View style={styles.profileChevron}>
                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                {/* Subscription CTA - prominent upsell */}
                <SubscriptionCard
                    hasPremiumAccess={hasPremiumAccess}
                    isOwnSubscription={!!isOwnSubscription}
                    expirationDate={formatExpirationDate(subscription.expirationDate)}
                    onUpgradePress={() => setShowPaywall(true)}
                    onManagePress={settings.handleManageSubscription}
                    onRestorePress={settings.handleRestorePurchases}
                    isRestoring={settings.isPurchasing}
                    delay={200}
                />

                {/* Settings Navigation */}
                <SettingsSection title="Settings" delay={250}>
                    <MenuItem
                        icon="person-circle-outline"
                        label="Profile"
                        description="Avatar and display name"
                        onPress={() => router.push('/(app)/settings/profile')}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="notifications-outline"
                        label="Notifications"
                        description="Push notification preferences"
                        onPress={() => router.push('/(app)/settings/notifications')}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="options-outline"
                        label="Preferences"
                        description="Comfort zone and security"
                        onPress={() => router.push('/(app)/settings/preferences')}
                    />
                </SettingsSection>

                {/* Relationship Section */}
                <SettingsSection title="Relationship" delay={300}>
                    <MenuItem
                        icon="heart-outline"
                        label="Partner"
                        rightText={partner?.name || (user?.couple_id ? 'Waiting...' : undefined)}
                        onPress={() => router.push('/(app)/settings/partner')}
                    />
                </SettingsSection>

                {/* Other Section */}
                <SettingsSection title="Other" delay={350}>
                    {isAnonymous && (
                        <>
                            <MenuItem
                                icon="shield-checkmark-outline"
                                label="Save Account"
                                description="Protect access across devices"
                                onPress={() => router.push('/(app)/settings/save-account' as any)}
                            />
                            <View style={styles.divider} />
                        </>
                    )}
                    <MenuItem
                        icon="help-circle-outline"
                        label="Help & Support"
                        onPress={() => router.push('/(app)/settings/support')}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="settings-outline"
                        label="Account"
                        onPress={() => router.push('/(app)/settings/account')}
                    />
                </SettingsSection>

                {/* Debug Section - Dev only */}
                {__DEV__ && (
                    <SettingsSection title="Debug" delay={400}>
                        <MenuItem
                            icon="server-outline"
                            label="Supabase Environment"
                            rightText={
                                process.env.EXPO_PUBLIC_SUPABASE_URL?.includes('ckjcrkjpmhqhiucifukx')
                                    ? 'Production'
                                    : 'Non-Production'
                            }
                            onPress={() => {}}
                            showChevron={false}
                        />
                        <View style={styles.divider} />
                        <MenuItem
                            icon="refresh-outline"
                            label="Reset Swipe Tutorial"
                            description="Show the tutorial again"
                            onPress={async () => {
                                await resetSwipeTutorial();
                                Alert.alert("Success", "Swipe tutorial has been reset.");
                            }}
                        />
                        <View style={styles.divider} />
                        <MenuItem
                            icon="heart-outline"
                            label="Reset Matches Tutorial"
                            description="Show the tutorial again"
                            onPress={async () => {
                                await resetMatchesTutorial();
                                Alert.alert("Success", "Matches tutorial has been reset.");
                            }}
                        />
                        <View style={styles.divider} />
                        <MenuItem
                            icon="school-outline"
                            label="Reset Onboarding"
                            description="Show onboarding flow again"
                            onPress={async () => {
                                if (!user?.id) return;
                                try {
                                    const { error } = await supabase
                                        .from('profiles')
                                        .update({ onboarding_completed: false })
                                        .eq('id', user.id);
                                    if (error) throw error;
                                    await fetchUser();
                                    Alert.alert("Success", "Onboarding has been reset.");
                                } catch (error) {
                                    Alert.alert("Error", "Failed to reset onboarding.");
                                }
                            }}
                        />
                    </SettingsSection>
                )}

                {/* Version */}
                <Animated.View
                    entering={FadeInDown.delay(__DEV__ ? 450 : 400).duration(500)}
                    style={styles.versionContainer}
                >
                    <View style={styles.versionBadge}>
                        <Ionicons name="heart" size={12} color={featureColors.profile.accent} />
                        <Text style={styles.version}>Sauci {versionString}</Text>
                    </View>
                </Animated.View>

                <View style={styles.bottomSpacer} />
            </ScrollView>

            <Paywall
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
            />
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
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        alignItems: 'center',
    },
    headerLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 3,
        color: colors.secondary,
        marginBottom: spacing.xs,
    },
    title: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.md,
        width: 100,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(155, 89, 182, 0.3)',
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: colors.secondary,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.sm,
        opacity: 0.6,
    },
    // Profile Preview
    profilePreview: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        backgroundColor: colors.glass.background,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        overflow: 'hidden',
    },
    profilePreviewContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    avatarGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        backgroundColor: colors.background,
    },
    avatarInner: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        ...typography.title2,
        fontSize: 24,
        color: colors.text,
    },
    profileInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    userName: {
        ...typography.headline,
        color: colors.text,
    },
    userEmail: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    profileChevron: {
        padding: spacing.xs,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginVertical: spacing.md,
    },
    // Version Badge
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
});
