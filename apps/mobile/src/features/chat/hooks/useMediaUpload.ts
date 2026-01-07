import { useRef, useState } from 'react';
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
    isValidPublicKeyJwk,
    sanitizePublicKeyJwk,
    verifyKeyPair,
} from '../../../lib/encryption';
import type { RSAPublicKeyJWK, EncryptedMediaPayload } from '../../../lib/encryption';
import { useEncryptionKeys } from '../../../hooks';

export function useMediaUpload(matchId: string, userId: string | undefined) {
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>(null);
    const verifiedKeysVersionRef = useRef<number | null>(null);
    const partnerRefreshRef = useRef(0);
    const PARTNER_REFRESH_TTL_MS = 2 * 60 * 1000;
    
    const refreshPartner = useAuthStore((s) => s.refreshPartner);
    const { publicKeyJwk, privateKeyJwk, hasKeys, isLoading: keysLoading } = useEncryptionKeys();
    
    // Check if E2EE is available for media
    const isE2EEAvailable =
        Platform.OS !== 'web' && hasKeys && !keysLoading && !!publicKeyJwk && !!privateKeyJwk;

    const uploadMedia = async (uri: string, mediaType: 'image' | 'video') => {
        if (!userId) return;
        setUploading(true);
        setUploadStatus({ mediaType, status: mediaType === 'video' ? 'compressing' : 'uploading', thumbnailUri: uri });

        try {
            // Block media uploads until encryption is ready (secure-only)
            if (!isE2EEAvailable || Platform.OS === 'web') {
                const readyError = new Error('Media security not ready. Please check your connection.');
                console.warn('[E2EE Media Upload] E2EE not available, blocking upload');
                throw readyError;
            }

            let fileUri = uri;
            let fileBody;
            let ext = mediaType === 'video' ? 'mp4' : 'jpg';
            let encryptedPayload: EncryptedMediaPayload;

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

            // CRITICAL: Read keys directly from global store at encryption time
            // This ensures we always use the most current keys, not potentially stale hook state
            const currentKeys = useAuthStore.getState().encryptionKeys;

            if (!currentKeys.hasKeys || !currentKeys.publicKeyJwk || !currentKeys.privateKeyJwk) {
                console.warn('[E2EE Media Upload] Keys not fully available in global store at encryption time');
                throw new Error('Media security not ready. Please check your connection.');
            }

            const senderPublicKey = currentKeys.publicKeyJwk;
            const senderPrivateKey = currentKeys.privateKeyJwk;

            // SAFETY CHECK: Verify the key pair works together before encrypting
            if (verifiedKeysVersionRef.current !== currentKeys.keysVersion) {
                console.log(
                    `[E2EE Media Upload] Verifying sender key pair (version ${currentKeys.keysVersion})...`
                );
                const isValidKeyPair = await verifyKeyPair(
                    senderPublicKey as RSAPublicKeyJWK,
                    senderPrivateKey
                );

                if (!isValidKeyPair) {
                    console.error('[E2EE Media Upload] CRITICAL: Sender key pair verification failed!');
                    throw new Error('Security check failed. Please restart the app.');
                }

                verifiedKeysVersionRef.current = currentKeys.keysVersion;
                console.log('[E2EE Media Upload] Sender key pair verified successfully');
            }

            console.log('[E2EE Media Upload] Using sender public key from global store, version:', currentKeys.keysVersion);

            // Refresh partner's profile only when key is missing/invalid or TTL expires
            const resolvePartnerProfile = async () => {
                const cachedPartner = useAuthStore.getState().partner;
                const cachedKey = cachedPartner?.public_key_jwk as RSAPublicKeyJWK | null | undefined;
                const hasValidKey = cachedKey ? isValidPublicKeyJwk(cachedKey) : false;
                const now = Date.now();
                const shouldRefresh = !hasValidKey || (now - partnerRefreshRef.current) > PARTNER_REFRESH_TTL_MS;

                if (!shouldRefresh) {
                    return cachedPartner;
                }

                console.log('[E2EE Media Upload] Refreshing partner profile...');
                try {
                    const freshPartner = await refreshPartner();
                    partnerRefreshRef.current = Date.now();
                    return freshPartner ?? useAuthStore.getState().partner;
                } catch (refreshError) {
                    console.warn('[E2EE Media Upload] Partner refresh failed, using cached key:', refreshError);
                    partnerRefreshRef.current = Date.now();
                    return cachedPartner;
                }
            };

            const freshPartner = await resolvePartnerProfile();

            let adminPublicKey: RSAPublicKeyJWK;
            let adminKeyId: string;

            try {
                adminPublicKey = await getAdminPublicKey();
                adminKeyId = await getAdminKeyId();

                if (!isValidPublicKeyJwk(adminPublicKey)) {
                    throw new Error('Admin public key is invalid');
                }
            } catch (adminKeyError) {
                console.error('[E2EE Media Upload] Failed to fetch admin key:', adminKeyError);
                throw new Error('Connection issue. Please try again.');
            }

            let partnerPublicKey = freshPartner?.public_key_jwk as RSAPublicKeyJWK | null | undefined;

            // Validate and sanitize partner's public key
            if (partnerPublicKey) {
                if (!isValidPublicKeyJwk(partnerPublicKey)) {
                    console.warn('[E2EE Media Upload] Partner public key is invalid, treating as unavailable');
                    partnerPublicKey = null;
                } else {
                    // Sanitize to remove trailing dots from base64 fields
                    partnerPublicKey = sanitizePublicKeyJwk(partnerPublicKey);
                }
            }

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
            const contentType = 'application/octet-stream';

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

            // Store the message with encryption metadata
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
