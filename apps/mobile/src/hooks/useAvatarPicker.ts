import { useState, useCallback, useRef } from 'react';
import { Alert, Platform, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

export interface UseAvatarPickerOptions {
    /** User ID for storage path. Required for upload. */
    userId?: string;
    /** If true, automatically uploads after selection. Default: false */
    autoUpload?: boolean;
    /** Called when an image is selected (before upload) */
    onSelect?: (uri: string) => void;
    /** Called after successful upload */
    onUploadComplete?: (publicUrl: string) => void;
    /** Called on upload error */
    onUploadError?: (error: Error) => void;
}

export interface UseAvatarPickerReturn {
    /** Local URI of selected image (before upload) */
    avatarUri: string | null;
    /** Set avatar URI directly */
    setAvatarUri: (uri: string | null) => void;
    /** Whether an upload is in progress */
    isUploading: boolean;
    /** Show the picker action sheet/dialog */
    showPicker: () => void;
    /** Upload the currently selected image to storage */
    uploadAvatar: () => Promise<string | null>;
    /** Clear the selected avatar */
    clearAvatar: () => void;
}

/**
 * Hook for avatar image picking and uploading.
 * Handles cross-platform image selection (camera/library) and Supabase storage upload.
 */
export function useAvatarPicker(options?: UseAvatarPickerOptions): UseAvatarPickerReturn {
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Use ref for options to avoid stale closures in callbacks
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Internal upload function that takes a URI parameter
    const uploadAvatarWithUri = useCallback(async (uri: string): Promise<string | null> => {
        const currentOptions = optionsRef.current;
        if (!uri || !currentOptions?.userId) {
            return null;
        }

        setIsUploading(true);

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
                const base64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64
                });
                fileBody = decode(base64);

                const uriExt = uri.split('.').pop()?.toLowerCase();
                if (uriExt && ['jpg', 'jpeg', 'png', 'webp'].includes(uriExt)) {
                    ext = uriExt === 'jpeg' ? 'jpg' : uriExt;
                }
            }

            const fileName = `${currentOptions.userId}/${Date.now()}.${ext}`;
            const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, fileBody, {
                    contentType,
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            currentOptions?.onUploadComplete?.(publicUrl);
            return publicUrl;
        } catch (error) {
            console.error('Error uploading avatar:', error);
            currentOptions?.onUploadError?.(error as Error);
            return null;
        } finally {
            setIsUploading(false);
        }
    }, []);

    const pickImage = useCallback(async (source: 'camera' | 'library') => {
        const currentOptions = optionsRef.current;

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
                    exif: false,
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
                    exif: false,
                });
            }

            if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;

                // Validate image is accessible on native platforms
                if (Platform.OS !== 'web') {
                    try {
                        const info = await FileSystem.getInfoAsync(uri);
                        if (!info.exists) {
                            Alert.alert('Error', 'Selected image could not be accessed.');
                            return;
                        }
                        // Warn if file is very large (> 10MB)
                        if (info.size && info.size > 10 * 1024 * 1024) {
                            Alert.alert('Large Image', 'This image is quite large and may take longer to upload.');
                        }
                    } catch (e) {
                        console.warn('Could not validate image:', e);
                    }
                }

                setAvatarUri(uri);
                currentOptions?.onSelect?.(uri);

                // Auto-upload if enabled
                if (currentOptions?.autoUpload) {
                    await uploadAvatarWithUri(uri);
                }
            }
        } catch (error) {
            console.error('Error picking avatar:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    }, [uploadAvatarWithUri]);

    const showPicker = useCallback(() => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Take Photo', 'Choose from Library'],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        pickImage('camera');
                    } else if (buttonIndex === 2) {
                        pickImage('library');
                    }
                }
            );
        } else {
            Alert.alert(
                'Add Profile Photo',
                'Choose an option',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Take Photo', onPress: () => pickImage('camera') },
                    { text: 'Choose from Library', onPress: () => pickImage('library') },
                ]
            );
        }
    }, [pickImage]);

    // Public upload function uses stored avatarUri
    const uploadAvatar = useCallback(async (): Promise<string | null> => {
        if (!avatarUri) return null;
        return uploadAvatarWithUri(avatarUri);
    }, [avatarUri, uploadAvatarWithUri]);

    const clearAvatar = useCallback(() => {
        setAvatarUri(null);
    }, []);

    return {
        avatarUri,
        setAvatarUri,
        isUploading,
        showPicker,
        uploadAvatar,
        clearAvatar,
    };
}
