import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { GradientBackground } from '../../components/ui';
import { FeedbackModal } from '../../components/feedback';
import { Paywall } from '../../components/paywall';
import { colors, featureColors, spacing, typography, radius } from '../../theme';
import { useAuthStore, useSubscriptionStore } from '../../store';
import { resetSwipeTutorial } from '../../lib/swipeTutorialSeen';
import { resetMatchesTutorial } from '../../lib/matchesTutorialSeen';
import { supabase } from '../../lib/supabase'; // Needed for debug reset

// Hooks
import { useProfileSettings, useCoupleManagement } from './hooks';

// Components
import { AppearanceSettings, CoupleStatus, NotificationSettings, PrivacySettings, DangerZone, SettingsSection, MenuItem, SubscriptionCard } from './components';

const MAX_CONTENT_WIDTH = 500;
const NAV_BAR_HEIGHT = 44;
const STATUS_BAR_HEIGHT = 60;
const HEADER_SCROLL_DISTANCE = 100;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export function ProfileScreen() {
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;

    const { user, partner, couple, fetchUser } = useAuthStore();
    const { subscription } = useSubscriptionStore();

    // Hooks
    const settings = useProfileSettings();
    const {
        handleUnpair,
        handleDeleteRelationship,
        handleResetProgress,
        handleSignOut,
        handleDeleteAccount,
        navigateToPairing
    } = useCoupleManagement();

    const [showFeedbackModal, setShowFeedbackModal] = React.useState(false);

    // Derived formatting
    const isOwnSubscription = user?.is_premium && subscription.isProUser;
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

    // Scroll animation
    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const heroStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE * 0.7],
            [1, 0],
            Extrapolation.CLAMP
        );
        const scale = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE],
            [1, 0.95],
            Extrapolation.CLAMP
        );
        return { opacity, transform: [{ scale }] };
    });

    const compactHeaderStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [HEADER_SCROLL_DISTANCE * 0.5, HEADER_SCROLL_DISTANCE],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    const navBarBackgroundStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE * 0.8],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    return (
        <GradientBackground>
            {/* Fixed Nav Bar */}
            <View style={styles.navBar}>
                <Animated.View style={[styles.navBarBackground, navBarBackgroundStyle]}>
                    {Platform.OS === "ios" ? (
                        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(13, 13, 26, 0.95)" }]} />
                    )}
                </Animated.View>
                
                <Animated.Text style={[styles.navBarTitle, compactHeaderStyle]} numberOfLines={1}>
                    Settings
                </Animated.Text>
            </View>

            <AnimatedScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.contentContainer,
                    isWideScreen && styles.contentContainerWide,
                ]}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                {/* Header title */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(500)}
                    style={[styles.header, heroStyle]}
                >
                    <Text style={styles.headerLabel}>YOUR SAUCI</Text>
                    <Text style={styles.title}>Settings</Text>
                    <View style={styles.separator}>
                        <View style={styles.separatorLine} />
                        <View style={styles.separatorDiamond} />
                        <View style={styles.separatorLine} />
                    </View>
                </Animated.View>

                {/* Profile Header */}
                <AppearanceSettings
                    user={user}
                    isUploadingAvatar={settings.isUploadingAvatar}
                    isEditingName={settings.isEditingName}
                    newName={settings.newName}
                    isUpdatingName={settings.isUpdatingName}
                    onAvatarPress={settings.handleAvatarPress}
                    onNewNameChange={settings.setNewName}
                    onUpdateName={settings.handleUpdateName}
                    onCancelEditName={settings.handleCancelEditName}
                    onStartEditingName={() => settings.setIsEditingName(true)}
                />

                {/* Partner */}
                <CoupleStatus
                    partner={partner}
                    couple={couple}
                    onUnpair={handleUnpair}
                    onPairingPress={navigateToPairing}
                />

                {/* Subscription Section */}
                <SubscriptionCard
                    hasPremiumAccess={hasPremiumAccess}
                    isOwnSubscription={!!isOwnSubscription}
                    expirationDate={formatExpirationDate(subscription.expirationDate)}
                    onUpgradePress={() => settings.setShowPaywall(true)}
                    onManagePress={settings.handleManageSubscription}
                    onRestorePress={settings.handleRestorePurchases}
                    isRestoring={settings.isPurchasing}
                    delay={350}
                />

                {/* Notifications */}
                <NotificationSettings
                    pushEnabled={settings.pushEnabled}
                    isUpdatingPush={settings.isUpdatingPush}
                    onPushToggle={settings.handlePushToggle}
                />

                {/* Preferences */}
                <PrivacySettings
                    maxIntensity={settings.maxIntensity}
                    isUpdatingIntensity={settings.isUpdatingIntensity}
                    onIntensityChange={settings.handleIntensityChange}
                    biometricAvailable={settings.biometricAvailable}
                    biometricEnabled={settings.biometricEnabled}
                    biometricType={settings.biometricType}
                    isUpdatingBiometric={settings.isUpdatingBiometric}
                    onBiometricToggle={settings.handleBiometricToggle}
                    partnerIntensity={settings.partnerIntensity}
                    partnerName={settings.partnerName}
                    partnerAvatar={settings.partnerAvatar}
                />

                {/* Account */}
                <SettingsSection title="Account" delay={425}>
                    <MenuItem
                        icon="log-out-outline"
                        label="Sign Out"
                        onPress={handleSignOut}
                        variant="danger"
                        showChevron={true}
                    />
                </SettingsSection>

                {/* Support */}
                <SettingsSection title="Support" delay={475}>
                    <MenuItem
                        icon="chatbubble-ellipses-outline"
                        label="Send Feedback"
                        description="Report bugs or request features"
                        onPress={() => setShowFeedbackModal(true)}
                    />
                    <View style={styles.preferencesDivider} />
                    <MenuItem
                        icon="shield-checkmark-outline"
                        label="Privacy Policy"
                        onPress={() => Linking.openURL('https://sauci.app/privacy')}
                    />
                    <View style={styles.preferencesDivider} />
                    <MenuItem
                        icon="document-text-outline"
                        label="Terms of Service"
                        onPress={() => Linking.openURL('https://sauci.app/terms')}
                    />
                </SettingsSection>

                {/* Debug Section */}
                {__DEV__ && (
                    <SettingsSection title="Debug" delay={550}>
                        <MenuItem
                            icon="refresh-outline"
                            label="Reset Swipe Tutorial"
                            description="Show the tutorial again"
                            onPress={async () => {
                                await resetSwipeTutorial();
                                Alert.alert("Success", "Swipe tutorial has been reset.");
                            }}
                        />
                        <View style={styles.preferencesDivider} />
                        <MenuItem
                            icon="heart-outline"
                            label="Reset Matches Tutorial"
                            description="Show the tutorial again"
                            onPress={async () => {
                                await resetMatchesTutorial();
                                Alert.alert("Success", "Matches tutorial has been reset.");
                            }}
                        />
                        <View style={styles.preferencesDivider} />
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

                {/* Danger Zone */}
                <DangerZone
                    onResetProgress={couple ? handleResetProgress : undefined}
                    onDeleteRelationship={couple ? handleDeleteRelationship : undefined}
                    onDeleteAccount={handleDeleteAccount}
                    hasRelationship={!!couple}
                />

                {/* Version */}
                <Animated.View
                    entering={FadeInDown.delay(couple ? 650 : 525).duration(500)}
                    style={styles.versionContainer}
                >
                    <View style={styles.versionBadge}>
                        <Ionicons name="heart" size={12} color={featureColors.profile.accent} />
                        <Text style={styles.version}>Sauci {versionString}</Text>
                    </View>
                </Animated.View>

                <View style={styles.bottomSpacer} />
            </AnimatedScrollView>

            {/* Modals */}
            <FeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
            />
            <Paywall
                visible={settings.showPaywall}
                onClose={() => settings.setShowPaywall(false)}
            />
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    // Fixed Nav Bar
    navBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: STATUS_BAR_HEIGHT - 10,
        paddingHorizontal: spacing.md,
        zIndex: 100,
    },
    navBarBackground: {
        ...StyleSheet.absoluteFillObject,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(155, 89, 182, 0.15)', // Purple tint for profile
        overflow: "hidden",
    },
    navBarTitle: {
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
    },
    contentContainer: {
        // Remove top padding here as the header adds it
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    contentContainerWide: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
    },
    header: {
        paddingTop: STATUS_BAR_HEIGHT + spacing.md,
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
    preferencesDivider: {
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
