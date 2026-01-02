import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform, ActionSheetIOS, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { useAuthStore, useSubscriptionStore, usePacksStore } from '../../../store';
import { supabase } from '../../../lib/supabase';
import { Events } from '../../../lib/analytics';
import {
    isBiometricAvailable,
    isBiometricEnabled,
    setBiometricEnabled,
    getBiometricType,
} from '../../../lib/biometricAuth';

export function useProfileSettings() {
    const { user, fetchUser } = useAuthStore();
    const { fetchPacks } = usePacksStore();
    const { restorePurchases, isPurchasing } = useSubscriptionStore();

    // Name Editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user?.name || "");
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    // Avatar
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // Preferences
    const [showExplicit, setShowExplicit] = useState(user?.show_explicit_content ?? true);
    const [isUpdatingExplicit, setIsUpdatingExplicit] = useState(false);

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
        if (user?.show_explicit_content !== undefined) {
            setShowExplicit(user.show_explicit_content);
        }
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
            Events.profileUpdated(["show_explicit_content"]);
        } catch (error) {
            // Revert on error
            setShowExplicit(!value);
            Alert.alert("Error", "Failed to update preference. Please try again.");
        } finally {
            setIsUpdatingExplicit(false);
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
        showExplicit,
        isUpdatingExplicit,
        biometricAvailable,
        biometricEnabled: biometricEnabledState,
        biometricType,
        isUpdatingBiometric,
        showPaywall,
        setShowPaywall,
        isPurchasing,

        // Actions
        handleUpdateName,
        handleCancelEditName,
        handleAvatarPress,
        handleExplicitToggle,
        handleBiometricToggle,
        handleRestorePurchases,
        handleManageSubscription,
    };
}
