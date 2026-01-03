/**
 * MessageContent - Renders message content (text, images, videos)
 * Handles media reveal logic, expired media, and loading states.
 * Supports both v1 (plaintext) and v2 (E2EE encrypted) messages.
 */
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, spacing, radius } from '../../../theme';
import { MessageMeta } from './MessageMeta';
import { ChatVideoPlayer } from './ChatVideoPlayer';
import { useDecryptedMessage, useDecryptedMedia } from '../../../hooks';
import type { KeysMetadata } from '../../../lib/encryption';
import type { Message } from '../types';

const ACCENT = colors.premium.gold;

export interface MessageContentProps {
    item: Message;
    isMe: boolean;
    currentUserId: string;
    revealMessage: (id: string) => void;
    onImagePress: (uri: string) => void;
    onVideoFullScreen: (uri: string) => void;
}

export function MessageContent({
    item,
    isMe,
    currentUserId,
    revealMessage,
    onImagePress,
    onVideoFullScreen,
}: MessageContentProps) {
    // Check if message was deleted for everyone
    if (item.deleted_at) {
        return (
            <View style={styles.deletedContainer}>
                <Ionicons
                    name="ban-outline"
                    size={14}
                    color={colors.textTertiary}
                />
                <Text style={styles.deletedText}>
                    {isMe ? 'You deleted this message' : 'This message was deleted'}
                </Text>
            </View>
        );
    }

    // Use decryption hook for E2EE text messages
    const {
        content: decryptedContent,
        isDecrypting,
        error: decryptError,
        errorCode: decryptErrorCode,
        retry: retryDecrypt,
    } = useDecryptedMessage({
        message: {
            id: item.id,
            content: item.content,
            version: item.version,
            encrypted_content: item.encrypted_content,
            encryption_iv: item.encryption_iv,
            keys_metadata: item.keys_metadata as KeysMetadata | null,
            user_id: item.user_id,
        },
        currentUserId,
    });

    const isVideo = (item as any).media_type === 'video';
    const isViewed = !!item.media_viewed_at;
    const isRecipientHidden = !isMe && !isViewed;

    // Use decryption hook for E2EE media (images/videos)
    const {
        uri: mediaUri,
        isDecrypting: isDecryptingMedia,
        error: mediaError,
        errorCode: mediaErrorCode,
        retry: retryMedia,
        isEncrypted: isMediaEncrypted,
    } = useDecryptedMedia({
        messageId: item.id,
        mediaPath: item.media_path ?? null,
        version: item.version,
        encryptionIv: item.encryption_iv,
        keysMetadata: item.keys_metadata as KeysMetadata | null,
        isMe,
        mediaType: isVideo ? 'video' : 'image',
        shouldFetch: !!item.media_path && !isRecipientHidden,
    });

    const isPendingMedia = mediaErrorCode === 'E2EE_PENDING_RECIPIENT_KEY';

    const showSecureMediaInfo = () => {
        Alert.alert(
            'Secure media',
            "To keep your chats private, photos and videos are locked to each person’s secure key.\n\nThis media was sent before your secure key was ready, so it’s still locked. We’re now securely updating the lock for your device (without exposing the media) so you can open it.\n\nIf it doesn’t unlock in a few seconds, tap “Try again”.",
            [
                { text: 'OK', style: 'cancel' },
                { text: 'Try again', onPress: () => retryMedia() },
            ]
        );
    };

    // Handle expired videos
    const isExpired = !!(item as any).media_expired;

    if (isExpired && isVideo) {
        return (
            <View>
                <View style={styles.expiredMedia}>
                    <LinearGradient
                        colors={['rgba(22, 33, 62, 0.8)', 'rgba(13, 13, 26, 0.9)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.expiredIconContainer}>
                        <Ionicons name="videocam-off-outline" size={28} color={colors.textTertiary} />
                    </View>
                    <Text style={styles.expiredText}>Video expired</Text>
                    <Text style={styles.expiredSubtext}>Videos are deleted 30 days after viewing</Text>
                </View>
                <MessageMeta item={item} isMe={isMe} />
            </View>
        );
    }

    // Handle media (images and videos)
    if (item.media_path || isExpired) {
        const canOpenFullScreen = (isMe || isViewed) && !isVideo; // Only images can go fullscreen
        const hasMediaError = !!mediaError;
        const isLoading = isDecryptingMedia || (!mediaUri && !hasMediaError && !isRecipientHidden);

        // Video content
        if (isVideo) {
            return (
                <View>
                    {isRecipientHidden ? (
                        // Clean reveal UI for unrevealed videos
                        <TouchableOpacity
                            style={[styles.messageVideo, styles.unrevealedPlaceholder]}
                            activeOpacity={0.8}
                            onPress={() => revealMessage(item.id)}
                        >
                            <LinearGradient
                                colors={['rgba(22, 33, 62, 0.95)', 'rgba(13, 13, 26, 0.98)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <LinearGradient
                                colors={gradients.premiumGold as [string, string]}
                                style={styles.revealIconContainer}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="eye-off-outline" size={24} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.unrevealedText}>Video hidden</Text>
                            <Text style={styles.revealHint}>Tap to reveal</Text>
                        </TouchableOpacity>
                    ) : isPendingMedia ? (
                        <TouchableOpacity activeOpacity={0.85} onPress={showSecureMediaInfo}>
                            <View style={[styles.messageVideo, styles.secureMediaPlaceholder]}>
                                <LinearGradient
                                    colors={['rgba(22, 33, 62, 0.85)', 'rgba(13, 13, 26, 0.95)']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <Ionicons name="lock-closed-outline" size={32} color={colors.textSecondary} />
                                <Text style={styles.secureMediaPlaceholderText}>Secure video</Text>
                                <Text style={styles.secureMediaPlaceholderSubtext}>Finishing security setup • Tap for info</Text>
                                {isDecryptingMedia && <ActivityIndicator color={ACCENT} />}
                            </View>
                        </TouchableOpacity>
                    ) : mediaUri || hasMediaError ? (
                        <ChatVideoPlayer
                            signedUrl={mediaUri}
                            storagePath={item.media_path!}
                            urlError={hasMediaError}
                            onFullScreen={onVideoFullScreen}
                        />
                    ) : (
                        <View style={[styles.messageVideo, styles.messageImageLoading]}>
                            <ActivityIndicator color={ACCENT} />
                        </View>
                    )}
                    {/* Viewed indicator for sender */}
                    {isMe && isViewed && (
                        <View style={styles.viewedBadge}>
                            <Ionicons name="eye" size={12} color={colors.success} />
                            <Text style={styles.viewedText}>Viewed</Text>
                        </View>
                    )}
                    <MessageMeta item={item} isMe={isMe} />
                </View>
            );
        }

        // Image content
        return (
            <View>
                <TouchableOpacity
                    activeOpacity={isPendingMedia || canOpenFullScreen ? 0.8 : 1}
                    onPress={() => {
                        if (isPendingMedia) {
                            showSecureMediaInfo();
                            return;
                        }
                        if (canOpenFullScreen && mediaUri) {
                            onImagePress(mediaUri);
                        }
                    }}
                    disabled={!(isPendingMedia || (canOpenFullScreen && !!mediaUri))}
                >
                    {isRecipientHidden ? (
                        <TouchableOpacity
                            style={[styles.messageImage, styles.unrevealedPlaceholder]}
                            activeOpacity={0.8}
                            onPress={() => revealMessage(item.id)}
                        >
                            <LinearGradient
                                colors={['rgba(22, 33, 62, 0.95)', 'rgba(13, 13, 26, 0.98)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <LinearGradient
                                colors={gradients.premiumGold as [string, string]}
                                style={styles.revealIconContainer}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="eye-off-outline" size={24} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.unrevealedText}>Photo hidden</Text>
                            <Text style={styles.revealHint}>Tap to reveal</Text>
                        </TouchableOpacity>
                    ) : mediaUri ? (
                        <Image
                            source={{ uri: mediaUri }}
                            style={styles.messageImage}
                            blurRadius={0}
                            cachePolicy="disk"
                            transition={200}
                        />
                    ) : isPendingMedia ? (
                        <View style={[styles.messageImage, styles.secureMediaPlaceholder]}>
                            <LinearGradient
                                colors={['rgba(22, 33, 62, 0.85)', 'rgba(13, 13, 26, 0.95)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <Ionicons name="lock-closed-outline" size={32} color={colors.textSecondary} />
                            <Text style={styles.secureMediaPlaceholderText}>Secure photo</Text>
                            <Text style={styles.secureMediaPlaceholderSubtext}>Finishing security setup • Tap for info</Text>
                            {isDecryptingMedia && <ActivityIndicator color={ACCENT} />}
                        </View>
                    ) : hasMediaError ? (
                        <View style={[styles.messageImage, styles.messageImageError]}>
                            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                            <Text style={styles.messageImageErrorText}>Failed to load image</Text>
                        </View>
                    ) : (
                        <View style={[styles.messageImage, styles.messageImageLoading]}>
                            <ActivityIndicator color={ACCENT} />
                        </View>
                    )}
                </TouchableOpacity>
                {/* Viewed indicator for sender */}
                {isMe && isViewed && (
                    <View style={styles.viewedBadge}>
                        <Ionicons name="eye" size={12} color={colors.success} />
                        <Text style={styles.viewedText}>Viewed</Text>
                    </View>
                )}
                <MessageMeta item={item} isMe={isMe} />
            </View>
        );
    }

    // Text message
    const version = item.version ?? 1;
    const isV2 = version === 2;

    const showSecureMessageInfo = () => {
        Alert.alert(
            'Secure message',
            "To keep your chats private, each message is locked to your device’s secure key.\n\nThis message was sent before your secure key was ready, so it’s still locked. We’re now securely updating the lock for your device (without exposing the message content) so you can read it.\n\nIf it doesn’t unlock in a few seconds, tap “Try again”.",
            [
                { text: 'OK', style: 'cancel' },
                { text: 'Try again', onPress: () => retryDecrypt() },
            ]
        );
    };

    const renderText = () => {
        if (decryptErrorCode === 'E2EE_PENDING_RECIPIENT_KEY') {
            return (
                <TouchableOpacity activeOpacity={0.85} onPress={showSecureMessageInfo}>
                    <View style={styles.securePlaceholder}>
                        <View style={styles.securePlaceholderRow}>
                            <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.securePlaceholderTitle}>Secure message</Text>
                            {isDecrypting && <ActivityIndicator size="small" color={ACCENT} />}
                        </View>
                        <Text style={styles.securePlaceholderSubtext}>Finishing security setup • Tap for info</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        if (isDecrypting) {
            return (
                <View style={styles.decryptingContainer}>
                    <ActivityIndicator size="small" color={ACCENT} />
                </View>
            );
        }

        if (decryptError) {
            return (
                <TouchableOpacity activeOpacity={0.85} onPress={retryDecrypt}>
                    <Text style={[styles.messageText, styles.errorText]}>Couldn’t open secure message • Tap to retry</Text>
                </TouchableOpacity>
            );
        }

        if (isV2) {
            return <Text style={styles.messageText}>{decryptedContent ?? 'Secure message'}</Text>;
        }

        return <Text style={styles.messageText}>{item.content ?? 'Failed to load message'}</Text>;
    };

    return (
        <>
            {renderText()}
            <MessageMeta item={item} isMe={isMe} />
        </>
    );
}

const styles = StyleSheet.create({
    deletedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    deletedText: {
        color: colors.textTertiary,
        fontSize: 14,
        fontStyle: 'italic',
    },
    messageText: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 22,
    },
    securePlaceholder: {
        gap: spacing.xs,
    },
    securePlaceholderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    securePlaceholderTitle: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    securePlaceholderSubtext: {
        color: colors.textTertiary,
        fontSize: 12,
    },
    decryptingContainer: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    decryptingText: {
        color: colors.textSecondary,
        fontSize: 11,
        marginTop: spacing.xs,
    },
    errorText: {
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: radius.md,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    secureMediaPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        overflow: 'hidden',
    },
    secureMediaPlaceholderText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    secureMediaPlaceholderSubtext: {
        color: colors.textTertiary,
        fontSize: 11,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
    },
    messageImageLoading: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageImageError: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
    },
    messageImageErrorText: {
        color: colors.textSecondary,
        fontSize: 12,
    },
    unrevealedPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        overflow: 'hidden',
    },
    unrevealedText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    revealHint: {
        color: gradients.premiumGold[0],
        fontSize: 12,
        fontWeight: '500',
    },
    messageVideo: {
        width: 200,
        height: 200,
        borderRadius: radius.md,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
    },
    revealIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: spacing.xs,
    },
    viewedText: {
        color: colors.success,
        fontSize: 11,
        fontWeight: '500',
    },
    expiredMedia: {
        width: 200,
        height: 150,
        borderRadius: radius.md,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
    },
    expiredIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    expiredText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    expiredSubtext: {
        color: colors.textTertiary,
        fontSize: 11,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
    },
});

export default MessageContent;
