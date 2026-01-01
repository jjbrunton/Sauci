import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, spacing, radius } from '../../../theme';
import { useVideoCache } from '../hooks';


export interface ChatVideoPlayerProps {
    /** Signed URL for the video */
    signedUrl: string | null;
    /** Storage path for caching */
    storagePath: string;
    /** Whether there was an error loading the URL */
    urlError: boolean;
    /** Callback when fullscreen is requested */
    onFullScreen: (uri: string) => void;
}

const ACCENT = colors.premium.gold;

/**
 * Video player component with native-like tap behavior.
 * Supports play/pause, fullscreen, caching, and loading states.
 */
export function ChatVideoPlayer({
    signedUrl,
    storagePath,
    urlError,
    onFullScreen,
}: ChatVideoPlayerProps) {
    const videoRef = useRef<Video>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasEnded, setHasEnded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Use video cache hook
    const { cachedUri, cacheVideoFile } = useVideoCache(storagePath, signedUrl);

    // Handle playback status updates
    const handlePlaybackStatusUpdate = useCallback(async (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;

        setIsLoading(false);
        setIsPlaying(status.isPlaying);

        if (status.didJustFinish) {
            setHasEnded(true);
            setIsPlaying(false);

            // Cache in background if not already cached
            if (signedUrl && !cachedUri) {
                cacheVideoFile();
            }
        }
    }, [signedUrl, storagePath, cachedUri]);

    // Toggle play/pause with native-like behavior
    const handleTapToPlay = useCallback(async () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            await videoRef.current.pauseAsync();
            setIsPlaying(false);
        } else {
            if (hasEnded) {
                await videoRef.current.setPositionAsync(0);
                setHasEnded(false);
            }
            await videoRef.current.playAsync();
            setIsPlaying(true);

            // Start caching when playback starts
            if (signedUrl && !cachedUri) {
                cacheVideoFile();
            }
        }
    }, [isPlaying, hasEnded, signedUrl, storagePath, cachedUri]);

    // Handle full screen
    const handleFullScreen = useCallback(() => {
        const uri = cachedUri || signedUrl;
        if (uri) {
            if (videoRef.current && isPlaying) {
                videoRef.current.pauseAsync();
                setIsPlaying(false);
            }
            onFullScreen(uri);
        }
    }, [cachedUri, signedUrl, isPlaying, onFullScreen]);

    const videoSource = cachedUri || signedUrl;

    if (urlError || !videoSource) {
        return (
            <View style={[styles.video, styles.errorContainer]}>
                <Ionicons name="videocam-outline" size={32} color={colors.textSecondary} />
                <Text style={styles.errorText}>Video unavailable</Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleTapToPlay}
            onLongPress={handleFullScreen}
            delayLongPress={300}
            style={styles.container}
        >
            <Video
                ref={videoRef}
                source={{ uri: videoSource }}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                isLooping={false}
                shouldPlay={false}
                positionMillis={0}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />

            {/* Loading indicator */}
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={ACCENT} size="small" />
                </View>
            )}

            {/* Play/Replay overlay */}
            {!isPlaying && !isLoading && (
                <View style={styles.playOverlay}>
                    <LinearGradient
                        colors={gradients.premiumGold as [string, string]}
                        style={styles.playButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons
                            name={hasEnded ? 'refresh' : 'play'}
                            size={24}
                            color={colors.text}
                            style={hasEnded ? undefined : { marginLeft: 3 }}
                        />
                    </LinearGradient>
                </View>
            )}

            {/* Full screen button */}
            {!isPlaying && !isLoading && (
                <TouchableOpacity
                    style={styles.fullScreenButton}
                    onPress={handleFullScreen}
                    activeOpacity={0.7}
                >
                    <Ionicons name="expand-outline" size={16} color={colors.text} />
                </TouchableOpacity>
            )}

            {/* Cached indicator */}
            {cachedUri && !isPlaying && (
                <View style={styles.cachedBadge}>
                    <Ionicons name="download-outline" size={10} color={colors.textSecondary} />
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
    },
    errorContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    errorText: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: spacing.xs,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenButton: {
        position: 'absolute',
        bottom: spacing.sm,
        right: spacing.sm,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cachedBadge: {
        position: 'absolute',
        top: spacing.xs,
        left: spacing.xs,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ChatVideoPlayer;
