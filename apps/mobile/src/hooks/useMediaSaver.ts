import { useState } from 'react';
import { Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

export function useMediaSaver() {
    const [saving, setSaving] = useState(false);
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

    const saveMedia = async (uri: string, type: 'image' | 'video') => {
        try {
            setSaving(true);

            // Check permissions
            if (!permissionResponse?.granted) {
                const { granted } = await requestPermission();
                if (!granted) {
                    Alert.alert(
                        'Permission required',
                        'Please allow access to your photo library to save media.'
                    );
                    setSaving(false);
                    return;
                }
            }

            // Handle remote URIs
            let fileUri = uri;
            if (uri.startsWith('http') || uri.startsWith('https')) {
                const extension = type === 'video' ? '.mp4' : '.jpg';
                const fileName = `download_${Date.now()}${extension}`;
                const downloadRes = await FileSystem.downloadAsync(
                    uri,
                    FileSystem.cacheDirectory + fileName
                );
                fileUri = downloadRes.uri;
            }

            // Save to library
            await MediaLibrary.createAssetAsync(fileUri);
            
            Alert.alert('Saved', `${type === 'video' ? 'Video' : 'Image'} saved to your gallery.`);

            // Cleanup if we downloaded
            if (uri !== fileUri) {
                await FileSystem.deleteAsync(fileUri, { idempotent: true });
            }

        } catch (error) {
            console.error('Error saving media:', error);
            Alert.alert('Error', 'Failed to save media.');
        } finally {
            setSaving(false);
        }
    };

    return {
        saveMedia,
        saving,
    };
}
