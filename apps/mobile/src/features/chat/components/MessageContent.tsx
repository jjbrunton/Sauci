/**
 * MessageContent - Renders message content (text, images, videos)
 * Handles media reveal logic, expired media, and loading states.
 */
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, spacing, radius } from '../../../theme';
import { MessageMeta } from './MessageMeta';
import { ChatVideoPlayer } from './ChatVideoPlayer';
import { getCachedSignedUrl, getStoragePath } from '../../../lib/imageCache';
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

const MessageContentComponent: React.FC<MessageContentProps> = ({
    item,
    isMe,
    currentUserId,
    revealMessage,
    onImagePress,
    onVideoFullScreen,
}) => {
    const isDeleted = !!item.deleted_at;
    const isVideo = item.media_type === 'video';
    const isViewed = !!item.media_viewed_at;
    const isRecipientHidden = !isMe && !isViewed;

    // Get signed URL for media
    const [mediaUri, setMediaUri] = useState<string | null>(null);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaError, setMediaError] = useState(false);

    useEffect(() => {
        if (isDeleted || !item.media_path || isRecipientHidden) {
            setMediaUri(null);
            return;
        }

        const fetchMediaUrl = async () => {
            setMediaLoading(true);
            setMediaError(false);
            try {
                const storagePath = getStoragePath(item.media_path!);
                const signedUrl = await getCachedSignedUrl(storagePath, 'chat-media');

                if (!signedUrl) {
                    throw new Error('Missing signed URL for chat media');
                }

                setMediaUri(signedUrl);
            } catch (err) {
                console.error('Failed to get media URL:', err);
                setMediaUri(null);
                setMediaError(true);
            } finally {
                setMediaLoading(false);
            }
        };

        fetchMediaUrl();
    }, [item.media_path, isRecipientHidden, isDeleted]);

    // Handle expired videos
    const isExpired = !!item.media_expired;

    // Check if message was deleted for everyone
    if (isDeleted) {
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
        const isLoading = mediaLoading || (!mediaUri && !mediaError && !isRecipientHidden);

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
                    ) : mediaUri || mediaError ? (
                        <ChatVideoPlayer
                            signedUrl={mediaUri}
                            storagePath={item.media_path!}
                            urlError={mediaError}
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
                    activeOpacity={canOpenFullScreen ? 0.8 : 1}
                    onPress={() => {
                        if (canOpenFullScreen && mediaUri) {
                            onImagePress(mediaUri);
                        }
                    }}
                    disabled={!(canOpenFullScreen && !!mediaUri)}
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
                    ) : mediaError ? (
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

    // Text message - display content directly
    return (
        <>
            <Text style={styles.messageText}>{item.content ?? 'Message unavailable'}</Text>
            <MessageMeta item={item} isMe={isMe} />
        </>
    );
};

// Wrap with React.memo for performance
export const MessageContent = React.memo(MessageContentComponent);

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
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: radius.md,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
