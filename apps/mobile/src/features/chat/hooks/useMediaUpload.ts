import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Video as VideoCompressor } from 'react-native-compressor';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../../../lib/supabase';
import { Events } from '../../../lib/analytics';
import { UploadStatus } from '../types';

export function useMediaUpload(matchId: string, userId: string | undefined) {
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>(null);

    const uploadMedia = async (uri: string, mediaType: 'image' | 'video') => {
        if (!userId) return;
        setUploading(true);
        setUploadStatus({ mediaType, status: mediaType === 'video' ? 'compressing' : 'uploading', thumbnailUri: uri });

        try {
            let fileUri = uri;
            let fileBody;
            let ext = mediaType === 'video' ? 'mp4' : 'jpg';

            // Compress videos on native platforms before upload
            if (mediaType === 'video' && Platform.OS !== 'web') {
                try {
                    console.log('Compressing video...');
                    fileUri = await VideoCompressor.compress(uri, {
                        compressionMethod: 'auto',
                        maxSize: 720, // Max 720p resolution
                        minimumFileSizeForCompress: 0, // Always compress
                    });
                    console.log('Video compressed successfully');
                    ext = 'mp4'; // Compressed videos are always mp4
                    // Update status to uploading after compression
                    setUploadStatus({ mediaType, status: 'uploading', thumbnailUri: uri });
                } catch (compressError) {
                    console.warn('Video compression failed, uploading original:', compressError);
                    // Fall back to original if compression fails
                    fileUri = uri;
                    setUploadStatus({ mediaType, status: 'uploading', thumbnailUri: uri });
                }
            }

            if (Platform.OS === 'web') {
                const response = await fetch(fileUri);
                const blob = await response.blob();
                fileBody = blob;

                // Detect extension from blob type
                if (mediaType === 'video') {
                    if (blob.type === 'video/mp4') ext = 'mp4';
                    else if (blob.type === 'video/quicktime') ext = 'mov';
                    else if (blob.type === 'video/webm') ext = 'webm';
                } else {
                    if (blob.type === 'image/png') ext = 'png';
                    else if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') ext = 'jpg';
                    else if (blob.type === 'image/gif') ext = 'gif';
                    else if (blob.type === 'image/webp') ext = 'webp';
                }
            } else {
                const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
                fileBody = decode(base64);
            }

            const fileName = `${matchId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

            const { error: uploadError } = await supabase.storage
                .from("chat-media")
                .upload(fileName, fileBody, {
                    contentType,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Store the message (plaintext v1)
            await supabase.from("messages").insert({
                match_id: matchId,
                user_id: userId,
                content: mediaType === 'video' ? 'Sent a video' : 'Sent an image',
                media_path: fileName,
                media_type: mediaType,
                media_expired: false,
                version: 1,
            });
            Events.mediaUploaded();

        } catch (error) {
            Alert.alert("Error", `Failed to upload ${mediaType}`);
            console.error(error);
        } finally {
            setUploading(false);
            setUploadStatus(null);
        }
    };

    return { uploading, uploadStatus, uploadMedia };
}
