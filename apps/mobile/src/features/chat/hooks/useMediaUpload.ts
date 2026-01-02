import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Video as VideoCompressor } from 'react-native-compressor';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../../../lib/supabase';
import { Events } from '../../../lib/analytics';
import { UploadStatus } from '../types';
import { useAuthStore } from '../../../store';
import {
    encryptMediaFile,
    getAdminPublicKey,
    getAdminKeyId,
    MESSAGE_VERSION_E2EE,
} from '../../../lib/encryption';
import type { RSAPublicKeyJWK, EncryptedMediaPayload } from '../../../lib/encryption';
import { useEncryptionKeys } from '../../../hooks';

export function useMediaUpload(matchId: string, userId: string | undefined) {
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>(null);
    
    const refreshPartner = useAuthStore((s) => s.refreshPartner);
    const { publicKeyJwk, hasKeys, isLoading: keysLoading } = useEncryptionKeys();
    
    // Check if E2EE is available for media
    const isE2EEAvailable = Platform.OS !== 'web' && hasKeys && !keysLoading && !!publicKeyJwk;

    const uploadMedia = async (uri: string, mediaType: 'image' | 'video') => {
        if (!userId) return;
        setUploading(true);
        setUploadStatus({ mediaType, status: mediaType === 'video' ? 'compressing' : 'uploading', thumbnailUri: uri });

        try {
            let fileUri = uri;
            let fileBody;
            let ext = mediaType === 'video' ? 'mp4' : 'jpg';
            let encryptedPayload: EncryptedMediaPayload | null = null;

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

            // Try to encrypt the media if E2EE is available
            if (isE2EEAvailable && Platform.OS !== 'web') {
                try {
                    // CRITICAL: Read keys directly from global store at encryption time
                    // This ensures we always use the most current keys, not potentially stale hook state
                    const currentKeys = useAuthStore.getState().encryptionKeys;

                    if (!currentKeys.hasKeys || !currentKeys.publicKeyJwk) {
                        console.warn('[E2EE Media Upload] No keys available in global store at encryption time');
                        throw new Error('No encryption keys available');
                    }

                    const senderPublicKey = currentKeys.publicKeyJwk;
                    console.log('[E2EE Media Upload] Using sender public key from global store, version:', currentKeys.keysVersion);

                    // Refresh partner's profile to get their latest public key
                    console.log('[E2EE Media Upload] Refreshing partner profile...');
                    const freshPartner = await refreshPartner();

                    const adminPublicKey = await getAdminPublicKey();
                    const adminKeyId = await getAdminKeyId();
                    const partnerPublicKey = freshPartner?.public_key_jwk as RSAPublicKeyJWK | null | undefined;

                    console.log('[E2EE Media Upload] Partner public key available:', !!partnerPublicKey);

                    encryptedPayload = await encryptMediaFile(
                        fileUri,
                        senderPublicKey as RSAPublicKeyJWK,
                        partnerPublicKey ?? null,
                        adminPublicKey,
                        adminKeyId
                    );
                    
                    // Use the encrypted file for upload
                    fileUri = encryptedPayload.encryptedFileUri;
                    ext = 'enc'; // Encrypted files use .enc extension
                    console.log('Media encrypted successfully');
                } catch (encryptError) {
                    console.warn('Media encryption failed, uploading unencrypted:', encryptError);
                    encryptedPayload = null;
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

                if (mediaType !== 'video' && !encryptedPayload) {
                    // Only use URI extension for non-videos and non-encrypted (videos are always mp4 after compression)
                    const uriExt = fileUri.split('.').pop();
                    if (uriExt && uriExt !== fileUri) {
                        ext = uriExt.toLowerCase();
                    }
                }
            }

            const fileName = `${matchId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const contentType = encryptedPayload
                ? 'application/octet-stream' // Encrypted files are binary
                : mediaType === 'video'
                    ? `video/${ext === 'mov' ? 'quicktime' : ext}`
                    : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

            const { error: uploadError } = await supabase.storage
                .from("chat-media")
                .upload(fileName, fileBody, {
                    contentType,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Clean up encrypted temp file
            if (encryptedPayload && encryptedPayload.encryptedFileUri) {
                try {
                    await FileSystem.deleteAsync(encryptedPayload.encryptedFileUri, { idempotent: true });
                } catch (cleanupError) {
                    console.warn('Failed to clean up encrypted temp file:', cleanupError);
                }
            }

            // Store the message with encryption metadata if encrypted
            if (encryptedPayload) {
                await supabase.from("messages").insert({
                    match_id: matchId,
                    user_id: userId,
                    content: mediaType === 'video' ? 'Sent a video' : 'Sent an image',
                    media_path: fileName,
                    media_type: mediaType,
                    media_expired: false,
                    version: MESSAGE_VERSION_E2EE,
                    encryption_iv: encryptedPayload.encryption_iv,
                    keys_metadata: encryptedPayload.keys_metadata as unknown as Record<string, unknown>,
                });
            } else {
                // Unencrypted upload (v1)
                await supabase.from("messages").insert({
                    match_id: matchId,
                    user_id: userId,
                    content: mediaType === 'video' ? 'Sent a video' : 'Sent an image',
                    media_path: fileName,
                    media_type: mediaType,
                    media_expired: false,
                });
            }
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
