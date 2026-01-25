import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useAuthStore, useSubscriptionStore, usePacksStore } from '../../../store';
import { supabase } from '../../../lib/supabase';
import { Events } from '../../../lib/analytics';
import { useAvatarPicker } from '../../../hooks/useAvatarPicker';
import {
    registerForPushNotificationsAsync,
    savePushToken,
    clearPushToken,
} from '../../../lib/notifications';
import {
    isBiometricAvailable,
    isBiometricEnabled,
    setBiometricEnabled,
    getBiometricType,
} from '../../../lib/biometricAuth';

// Intensity thresholds for backwards compatibility
// When hide_nsfw=true, max_intensity=2 (mild content only)
// When hide_nsfw=false, max_intensity=5 (all content)
const NSFW_OFF_INTENSITY = 2;
const NSFW_ON_INTENSITY = 5;

export function useProfileSettings() {
    const { user, fetchUser } = useAuthStore();
    const { fetchPacks } = usePacksStore();
    const { restorePurchases, isPurchasing } = useSubscriptionStore();

    // Name Editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user?.name || "");
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    // Avatar - using shared hook with immediate upload on select
    const handleAvatarUploadComplete = useCallback(async (publicUrl: string) => {
        if (!user?.id) return;

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

            await fetchUser();
            Events.avatarUploaded();
        } catch (error) {
            console.error('Error updating profile with avatar:', error);
            Alert.alert('Error', 'Failed to save photo. Please try again.');
        }
    }, [user?.id, fetchUser]);

    const handleAvatarUploadError = useCallback(() => {
        Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }, []);

    const {
        isUploading: isUploadingAvatar,
        showPicker: handleAvatarPress,
    } = useAvatarPicker({
        userId: user?.id,
        autoUpload: true,
        onUploadComplete: handleAvatarUploadComplete,
        onUploadError: handleAvatarUploadError,
    });

    // Hide NSFW
    const [hideNsfw, setHideNsfw] = useState(!!user?.hide_nsfw);
    const [isUpdatingHideNsfw, setIsUpdatingHideNsfw] = useState(false);

    // Notifications
    const [pushEnabled, setPushEnabled] = useState(!!user?.push_token);
    const [isUpdatingPush, setIsUpdatingPush] = useState(false);

    // Biometrics
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricEnabledState, setBiometricEnabledState] = useState(false);
    const [biometricType, setBiometricType] = useState("Face ID");
    const [isUpdatingBiometric, setIsUpdatingBiometric] = useState(false);

    // Paywall
    const [showPaywall, setShowPaywall] = useState(false);

    // Initialize state from user object
    useEffect(() => {
        if (user?.name) {
            setNewName(user.name);
        }
        setPushEnabled(!!user?.push_token);
        setHideNsfw(!!user?.hide_nsfw);
    }, [user]);

    // Check biometric availability
    useEffect(() => {
        const checkBiometric = async () => {
            const available = await isBiometricAvailable();
            setBiometricAvailable(available);

            if (available) {
                const enabled = await isBiometricEnabled();
                setBiometricEnabledState(enabled);

                const type = await getBiometricType();
                setBiometricType(type);
            }
        };

        checkBiometric();
    }, []);

    // Name Actions
    const handleUpdateName = async () => {
        if (!user?.id) return;

        const trimmedName = newName.trim();
        if (!trimmedName) {
            Alert.alert("Error", "Name cannot be empty");
            return;
        }

        if (trimmedName === user.name) {
            setIsEditingName(false);
            return;
        }

        setIsUpdatingName(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    name: trimmedName,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            await fetchUser();
            setIsEditingName(false);
            Events.profileUpdated(["name"]);
        } catch (error) {
            Alert.alert("Error", "Failed to update name. Please try again.");
            setNewName(user.name || "");
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleCancelEditName = useCallback(() => {
        setNewName(user?.name || "");
        setIsEditingName(false);
    }, [user?.name]);

    const handlePushToggle = async (value: boolean) => {
        if (!user?.id) return;

        if (Platform.OS === 'web') {
            setPushEnabled(false);
            Alert.alert("Not Supported", "Push notifications aren't available on web.");
            return;
        }

        setPushEnabled(value);
        setIsUpdatingPush(true);

        try {
            if (value) {
                const token = await registerForPushNotificationsAsync();
                if (!token) {
                    setPushEnabled(false);
                    Alert.alert(
                        "Enable Notifications",
                        "Allow notifications in system settings to receive alerts.",
                        [
                            { text: "Not Now", style: "cancel" },
                            { text: "Open Settings", onPress: () => Linking.openSettings() },
                        ]
                    );
                    return;
                }

                await savePushToken(user.id, token);
            } else {
                await clearPushToken(user.id);
            }

            await fetchUser();
        } catch (error) {
            setPushEnabled(!value);
            Alert.alert("Error", "Failed to update notification settings. Please try again.");
        } finally {
            setIsUpdatingPush(false);
        }
    };

    const handleBiometricToggle = async (value: boolean) => {
        setIsUpdatingBiometric(true);

        try {
            if (value) {
                const { authenticateWithBiometric } = await import('../../../lib/biometricAuth');
                const success = await authenticateWithBiometric();

                if (!success) {
                    Alert.alert(
                        "Authentication Failed",
                        `Could not verify your ${biometricType}. Please try again.`
                    );
                    return;
                }

                await setBiometricEnabled(true);
                setBiometricEnabledState(true);
            } else {
                await setBiometricEnabled(false);
                setBiometricEnabledState(false);
            }
        } catch (error) {
            setBiometricEnabledState(!value);
            Alert.alert("Error", `Failed to ${value ? "enable" : "disable"} ${biometricType}. Please try again.`);
        } finally {
            setIsUpdatingBiometric(false);
        }
    };

    const handleHideNsfwToggle = async (value: boolean) => {
        if (!user?.id) return;

        const previous = hideNsfw;
        setHideNsfw(value);
        setIsUpdatingHideNsfw(true);

        // Derive intensity from hide_nsfw for backwards compatibility
        const maxIntensity = value ? NSFW_OFF_INTENSITY : NSFW_ON_INTENSITY;
        const showExplicitContent = !value;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    hide_nsfw: value,
                    max_intensity: maxIntensity,
                    show_explicit_content: showExplicitContent,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            // Refresh user data and packs to reflect the change
            await fetchUser();
            await fetchPacks();
            Events.profileUpdated(["hide_nsfw", "max_intensity", "show_explicit_content"]);
        } catch (error) {
            // Revert on error
            setHideNsfw(previous);
            Alert.alert("Error", "Failed to update preference. Please try again.");
        } finally {
            setIsUpdatingHideNsfw(false);
        }
    };

    // Subscription Actions
    const handleRestorePurchases = async () => {
        const restored = await restorePurchases();
        if (restored) {
            Alert.alert("Success", "Your purchases have been restored!");
        } else {
            Alert.alert("No Purchases Found", "No previous purchases found to restore.");
        }
    };

    const handleManageSubscription = () => {
        Linking.openURL("https://apps.apple.com/account/subscriptions");
    };

    return {
        // State
        isEditingName,
        setIsEditingName,
        newName,
        setNewName,
        isUpdatingName,
        isUploadingAvatar,
        pushEnabled,
        isUpdatingPush,
        biometricAvailable,
        biometricEnabled: biometricEnabledState,
        biometricType,
        isUpdatingBiometric,
        hideNsfw,
        isUpdatingHideNsfw,
        showPaywall,
        setShowPaywall,
        isPurchasing,

        // Actions
        handleUpdateName,
        handleCancelEditName,
        handleAvatarPress,
        handlePushToggle,
        handleBiometricToggle,
        handleHideNsfwToggle,
        handleRestorePurchases,
        handleManageSubscription,
    };
}
