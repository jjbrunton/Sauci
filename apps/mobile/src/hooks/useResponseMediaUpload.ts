import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../lib/supabase';

export interface UseResponseMediaUploadOptions {
    userId: string;
    questionId: string;
}

export interface UploadResult {
    success: boolean;
    /** Storage path, e.g., "user123/question456_1706189234.jpg" */
    mediaPath?: string;
    error?: string;
}

export interface UseResponseMediaUploadReturn {
    /** Whether an upload is in progress */
    uploading: boolean;
    /** Upload a photo to response-media storage */
    uploadPhoto: (localUri: string) => Promise<UploadResult>;
    /** Upload an audio file to response-media storage */
    uploadAudio: (localUri: string, durationSeconds: number) => Promise<UploadResult>;
}

/**
 * Hook for uploading response media (photos and audio) to Supabase storage.
 * Uploads to the `response-media` bucket with path format: {userId}/{questionId}_{timestamp}.{ext}
 */
export function useResponseMediaUpload(
    options: UseResponseMediaUploadOptions
): UseResponseMediaUploadReturn {
    const [uploading, setUploading] = useState(false);

    // Use ref for options to avoid stale closures
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const uploadPhoto = useCallback(async (localUri: string): Promise<UploadResult> => {
        const { userId, questionId } = optionsRef.current;

        if (!userId || !questionId) {
            return { success: false, error: 'Missing userId or questionId' };
        }

        setUploading(true);

        try {
            let fileBody;
            let ext = 'jpg';

            if (Platform.OS === 'web') {
                const response = await fetch(localUri);
                const blob = await response.blob();
                fileBody = blob;

                // Detect extension from blob type
                if (blob.type === 'image/png') ext = 'png';
                else if (blob.type === 'image/webp') ext = 'webp';
                else if (blob.type === 'image/gif') ext = 'gif';
            } else {
                const base64 = await FileSystem.readAsStringAsync(localUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                fileBody = decode(base64);

                // Try to get extension from URI
                const uriExt = localUri.split('.').pop()?.toLowerCase();
                if (uriExt && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(uriExt)) {
                    ext = uriExt === 'jpeg' ? 'jpg' : uriExt;
                }
            }

            const timestamp = Date.now();
            const mediaPath = `${userId}/${questionId}_${timestamp}.${ext}`;
            const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

            const { error: uploadError } = await supabase.storage
                .from('response-media')
                .upload(mediaPath, fileBody, {
                    contentType,
                    upsert: false,
                });

            if (uploadError) {
                console.error('Error uploading photo:', uploadError);
                return { success: false, error: uploadError.message };
            }

            return { success: true, mediaPath };
        } catch (error) {
            console.error('Error uploading photo:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        } finally {
            setUploading(false);
        }
    }, []);

    const uploadAudio = useCallback(
        async (localUri: string, _durationSeconds: number): Promise<UploadResult> => {
            const { userId, questionId } = optionsRef.current;

            if (!userId || !questionId) {
                return { success: false, error: 'Missing userId or questionId' };
            }

            setUploading(true);

            try {
                let fileBody;
                let ext = 'm4a';
                let contentType = 'audio/m4a';

                if (Platform.OS === 'web') {
                    const response = await fetch(localUri);
                    const blob = await response.blob();
                    fileBody = blob;

                    // Detect extension from blob type
                    if (blob.type === 'audio/mpeg' || blob.type === 'audio/mp3') {
                        ext = 'mp3';
                        contentType = 'audio/mpeg';
                    } else if (blob.type === 'audio/wav') {
                        ext = 'wav';
                        contentType = 'audio/wav';
                    } else if (blob.type === 'audio/webm') {
                        ext = 'webm';
                        contentType = 'audio/webm';
                    } else if (blob.type === 'audio/mp4' || blob.type === 'audio/x-m4a') {
                        ext = 'm4a';
                        contentType = 'audio/m4a';
                    }
                } else {
                    const base64 = await FileSystem.readAsStringAsync(localUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    fileBody = decode(base64);

                    // Try to get extension from URI
                    const uriExt = localUri.split('.').pop()?.toLowerCase();
                    if (uriExt && ['m4a', 'mp3', 'wav', 'aac', 'caf'].includes(uriExt)) {
                        ext = uriExt;
                        if (ext === 'mp3') contentType = 'audio/mpeg';
                        else if (ext === 'wav') contentType = 'audio/wav';
                        else if (ext === 'aac') contentType = 'audio/aac';
                        else if (ext === 'caf') contentType = 'audio/x-caf';
                        else contentType = 'audio/m4a';
                    }
                }

                const timestamp = Date.now();
                const mediaPath = `${userId}/${questionId}_${timestamp}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('response-media')
                    .upload(mediaPath, fileBody, {
                        contentType,
                        upsert: false,
                    });

                if (uploadError) {
                    console.error('Error uploading audio:', uploadError);
                    return { success: false, error: uploadError.message };
                }

                return { success: true, mediaPath };
            } catch (error) {
                console.error('Error uploading audio:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            } finally {
                setUploading(false);
            }
        },
        []
    );

    return {
        uploading,
        uploadPhoto,
        uploadAudio,
    };
}
