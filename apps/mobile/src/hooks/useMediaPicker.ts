import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface MediaResult {
    /** URI of the selected/captured media */
    uri: string;
    /** Type of media */
    mediaType: 'image' | 'video';
    /** Original width if available */
    width?: number;
    /** Original height if available */
    height?: number;
    /** Duration in ms for videos */
    duration?: number;
}

export interface MediaPickerConfig {
    /** Quality for images (0-1). Default: 0.7 */
    imageQuality?: number;
    /** Max video duration in seconds for library picker. Default: 300 (5 min) */
    libraryVideoMaxDuration?: number;
    /** Max video duration in seconds for camera recording. Default: 60 (1 min) */
    cameraVideoMaxDuration?: number;
}

const DEFAULT_CONFIG: Required<MediaPickerConfig> = {
    imageQuality: 0.7,
    libraryVideoMaxDuration: 300,
    cameraVideoMaxDuration: 60,
};

/**
 * Hook for media picking and camera capture functionality.
 * Handles permissions and provides unified API for picking images/videos
 * from the library or capturing with the camera.
 *
 * @param config - Optional configuration for picker options
 * @returns Media picker functions
 */
export const useMediaPicker = (config?: MediaPickerConfig) => {
    const settings = { ...DEFAULT_CONFIG, ...config };

    /**
     * Request camera permissions with user-friendly error handling.
     * @returns true if granted, false otherwise
     */
    const requestCameraPermission = useCallback(async (): Promise<boolean> => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Camera Permission',
                'Please allow camera access to use this feature.'
            );
            return false;
        }
        return true;
    }, []);

    /**
     * Pick an image or video from the device library.
     * @returns MediaResult if selected, null if cancelled
     */
    const pickMedia = useCallback(async (): Promise<MediaResult | null> => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: settings.imageQuality,
            videoMaxDuration: settings.libraryVideoMaxDuration,
        });

        if (result.canceled) {
            return null;
        }

        const asset = result.assets[0];
        const isVideo = asset.type === 'video';

        return {
            uri: asset.uri,
            mediaType: isVideo ? 'video' : 'image',
            width: asset.width,
            height: asset.height,
            duration: asset.duration ?? undefined,
        };
    }, [settings.imageQuality, settings.libraryVideoMaxDuration]);

    /**
     * Take a photo using the device camera.
     * @returns MediaResult if captured, null if cancelled or permission denied
     */
    const takePhoto = useCallback(async (): Promise<MediaResult | null> => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            return null;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: settings.imageQuality,
        });

        if (result.canceled) {
            return null;
        }

        const asset = result.assets[0];
        return {
            uri: asset.uri,
            mediaType: 'image',
            width: asset.width,
            height: asset.height,
        };
    }, [settings.imageQuality, requestCameraPermission]);

    /**
     * Record a video using the device camera.
     * @returns MediaResult if recorded, null if cancelled or permission denied
     */
    const recordVideo = useCallback(async (): Promise<MediaResult | null> => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            return null;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: settings.imageQuality,
            videoMaxDuration: settings.cameraVideoMaxDuration,
        });

        if (result.canceled) {
            return null;
        }

        const asset = result.assets[0];
        return {
            uri: asset.uri,
            mediaType: 'video',
            width: asset.width,
            height: asset.height,
            duration: asset.duration ?? undefined,
        };
    }, [settings.imageQuality, settings.cameraVideoMaxDuration, requestCameraPermission]);

    return {
        pickMedia,
        takePhoto,
        recordVideo,
        requestCameraPermission,
    };
};
