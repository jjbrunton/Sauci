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
import { getCachedSignedUrl, getStoragePath } from '../../../lib/imageCache';
import { MessageMeta } from './MessageMeta';
import { ChatVideoPlayer } from './ChatVideoPlayer';
import type { Message } from '../types';

const ACCENT = colors.premium.gold;

export interface MessageContentProps {
    item: Message;
    isMe: boolean;
    revealMessage: (id: string) => void;
    onImagePress: (uri: string) => void;
    onVideoFullScreen: (uri: string) => void;
}

export function MessageContent({
    item,
    isMe,
    revealMessage,
    onImagePress,
    onVideoFullScreen,
}: MessageContentProps) {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [urlError, setUrlError] = useState(false);

    const isVideo = (item as any).media_type === 'video';
    const isViewed = !!item.media_viewed_at;
    const isRecipientHidden = !isMe && !isViewed;

    useEffect(() => {
        if (!item.media_path) {
            setSignedUrl(null);
            setUrlError(false);
            return;
        }

        if (isRecipientHidden) {
            setSignedUrl(null);
            setUrlError(false);
            return;
        }

        let isMounted = true;

        const fetchSignedUrl = async () => {
            const storagePath = getStoragePath(item.media_path!);
            const url = await getCachedSignedUrl(storagePath);

            if (!isMounted) return;

            if (url) {
                setSignedUrl(url);
            } else {
                setUrlError(true);
            }
        };

        fetchSignedUrl();

        return () => {
            isMounted = false;
        };
    }, [item.media_path, isRecipientHidden]);

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

        // Video content
        if (isVideo) {
            return (
                <View>
                    {isRecipientHidden ? (
                        // Blurred placeholder with reveal overlay for unrevealed videos
                        <View>
                            <View style={[styles.messageVideo, styles.videoBlurred]}>
                                <LinearGradient
                                    colors={['rgba(22, 33, 62, 0.9)', 'rgba(13, 13, 26, 0.95)']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <Ionicons name="videocam" size={40} color={colors.textTertiary} />
                            </View>
                            <TouchableOpacity
                                style={styles.revealOverlay}
                                activeOpacity={0.8}
                                onPress={() => revealMessage(item.id)}
                            >
                                <View style={styles.revealContent}>
                                    <LinearGradient
                                        colors={gradients.premiumGold as [string, string]}
                                        style={styles.revealIconContainer}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons name="eye-off-outline" size={24} color={colors.text} />
                                    </LinearGradient>
                                    <Text style={styles.revealText}>Tap to reveal video</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    ) : signedUrl || urlError ? (
                        <ChatVideoPlayer
                            signedUrl={signedUrl}
                            storagePath={item.media_path!}
                            urlError={urlError}
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
                    onPress={() => canOpenFullScreen && signedUrl && onImagePress(signedUrl)}
                    disabled={!canOpenFullScreen || !signedUrl}
                >
                    {isRecipientHidden ? (
                        <View style={[styles.messageImage, styles.unrevealedPlaceholder]}>
                            <LinearGradient
                                colors={['rgba(22, 33, 62, 0.95)', 'rgba(13, 13, 26, 0.98)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <View style={styles.unrevealedIconContainer}>
                                <Ionicons name="image-outline" size={28} color={colors.text} />
                            </View>
                            <Text style={styles.unrevealedText}>Photo hidden</Text>
                        </View>
                    ) : signedUrl ? (
                        <Image
                            source={{ uri: signedUrl }}
                            style={styles.messageImage}
                            blurRadius={0}
                            cachePolicy="disk"
                            transition={200}
                        />
                    ) : urlError ? (
                        <View style={[styles.messageImage, styles.messageImageError]}>
                            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                            <Text style={styles.messageImageErrorText}>Image unavailable</Text>
                        </View>
                    ) : (
                        <View style={[styles.messageImage, styles.messageImageLoading]}>
                            <ActivityIndicator color={ACCENT} />
                        </View>
                    )}
                </TouchableOpacity>
                {/* Reveal overlay for recipient */}
                {isRecipientHidden && (
                    <TouchableOpacity
                        style={styles.revealOverlay}
                        activeOpacity={0.8}
                        onPress={() => revealMessage(item.id)}
                    >
                        <View style={styles.revealContent}>
                            <LinearGradient
                                colors={gradients.premiumGold as [string, string]}
                                style={styles.revealIconContainer}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="eye-off-outline" size={24} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.revealText}>Tap to reveal</Text>
                        </View>
                    </TouchableOpacity>
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

    // Text message
    return (
        <>
            <Text style={styles.messageText}>{item.content}</Text>
            <MessageMeta item={item} isMe={isMe} />
        </>
    );
}

const styles = StyleSheet.create({
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
    unrevealedIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    unrevealedText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    messageVideo: {
        width: 200,
        height: 200,
        borderRadius: radius.md,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
    },
    videoBlurred: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    revealOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radius.md,
    },
    revealContent: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    revealIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    revealText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
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
