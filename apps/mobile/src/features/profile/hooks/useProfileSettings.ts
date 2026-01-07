import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform, ActionSheetIOS, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { useAuthStore, useSubscriptionStore, usePacksStore } from '../../../store';
import { supabase } from '../../../lib/supabase';
import { Events } from '../../../lib/analytics';
import type { IntensityLevel } from '../../../types';
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

const DEFAULT_MAX_INTENSITY: IntensityLevel = 2;

const normalizeIntensity = (value: number | null | undefined): IntensityLevel | null => {
    if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
    return null;
};

const getProfileMaxIntensity = (profile?: { max_intensity?: number | null; show_explicit_content?: boolean | null } | null): IntensityLevel => {
    const normalized = normalizeIntensity(profile?.max_intensity);
    if (normalized) return normalized;
    return profile?.show_explicit_content ? 5 : DEFAULT_MAX_INTENSITY;
};

export function useProfileSettings() {
    const { user, partner, fetchUser } = useAuthStore();
    const { fetchPacks } = usePacksStore();
    const { restorePurchases, isPurchasing } = useSubscriptionStore();

    // Partner's intensity level (for showing on slider)
    const partnerIntensity = partner ? getProfileMaxIntensity(partner) : null;

    // Name Editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user?.name || "");
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    // Avatar
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // Preferences
    const [maxIntensity, setMaxIntensity] = useState<IntensityLevel>(() => getProfileMaxIntensity(user));
    const [isUpdatingIntensity, setIsUpdatingIntensity] = useState(false);

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
        setMaxIntensity(getProfileMaxIntensity(user));
        setPushEnabled(!!user?.push_token);
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

    // Avatar Actions
    const handleAvatarPress = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Take Photo', 'Choose from Library'],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        pickAvatar('camera');
                    } else if (buttonIndex === 2) {
                        pickAvatar('library');
                    }
                }
            );
        } else {
            Alert.alert(
                'Change Profile Photo',
                'Choose an option',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Take Photo', onPress: () => pickAvatar('camera') },
                    { text: 'Choose from Library', onPress: () => pickAvatar('library') },
                ]
            );
        }
    };

    const pickAvatar = async (source: 'camera' | 'library') => {
        try {
            let result: ImagePicker.ImagePickerResult;

            if (source === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Camera access is required to take a photo.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Photo library access is required to choose a photo.');
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                });
            }

            if (!result.canceled && result.assets[0]) {
                await uploadAvatar(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking avatar:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const uploadAvatar = async (uri: string) => {
        if (!user?.id) return;

        setIsUploadingAvatar(true);

        try {
            let fileBody;
            let ext = 'jpg';

            if (Platform.OS === 'web') {
                const response = await fetch(uri);
                const blob = await response.blob();
                fileBody = blob;

                if (blob.type === 'image/png') ext = 'png';
                else if (blob.type === 'image/webp') ext = 'webp';
            } else {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                fileBody = decode(base64);

                const uriExt = uri.split('.').pop()?.toLowerCase();
                if (uriExt && ['jpg', 'jpeg', 'png', 'webp'].includes(uriExt)) {
                    ext = uriExt === 'jpeg' ? 'jpg' : uriExt;
                }
            }

            const fileName = `${user.id}/${Date.now()}.${ext}`;
            const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, fileBody, {
                    contentType,
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Update profile with avatar URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Refresh user data
            await fetchUser();
            Events.avatarUploaded();
        } catch (error) {
            console.error('Error uploading avatar:', error);
            Alert.alert('Error', 'Failed to upload photo. Please try again.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    // Preference Actions
    const handleIntensityChange = async (value: IntensityLevel) => {
        if (!user?.id) return;

        const previous = maxIntensity;
        setMaxIntensity(value);
        setIsUpdatingIntensity(true);

        const showExplicitContent = value >= 3;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    max_intensity: value,
                    show_explicit_content: showExplicitContent,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            // Refresh user data and packs to reflect the change
            await fetchUser();
            await fetchPacks();
            Events.profileUpdated(["max_intensity", "show_explicit_content"]);
        } catch (error) {
            // Revert on error
            setMaxIntensity(previous);
            Alert.alert("Error", "Failed to update preference. Please try again.");
        } finally {
            setIsUpdatingIntensity(false);
        }
    };

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
        maxIntensity,
        isUpdatingIntensity,
        pushEnabled,
        isUpdatingPush,
        biometricAvailable,
        biometricEnabled: biometricEnabledState,
        biometricType,
        isUpdatingBiometric,
        showPaywall,
        setShowPaywall,
        isPurchasing,

        // Partner info for comfort zone comparison
        partnerIntensity,
        partnerName: partner?.name ?? undefined,
        partnerAvatar: partner?.avatar_url ?? undefined,

        // Actions
        handleUpdateName,
        handleCancelEditName,
        handleAvatarPress,
        handleIntensityChange,
        handlePushToggle,
        handleBiometricToggle,
        handleRestorePurchases,
        handleManageSubscription,
    };
}
