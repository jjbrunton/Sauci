import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { colors, gradients, spacing, radius } from '../../../theme';
import { UploadStatus } from '../types';

export interface UploadProgressProps {
    uploadStatus: UploadStatus;
}

const ACCENT = colors.premium.gold;

/**
 * Upload progress skeleton component showing when media is being uploaded.
 * Displays a shimmer effect with thumbnail preview for images.
 */
export function UploadProgress({ uploadStatus }: UploadProgressProps) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
        );
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
    }));

    if (!uploadStatus) return null;

    const isVideo = uploadStatus.mediaType === 'video';
    const statusText = uploadStatus.status === 'compressing'
        ? 'Compressing video...'
        : `Uploading ${isVideo ? 'video' : 'image'}...`;

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.container}
        >
            <View style={styles.bubbleContainer}>
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={styles.bubble}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Silk highlight */}
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.15)', 'transparent']}
                        style={styles.silkHighlight}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />

                    {/* Skeleton media placeholder */}
                    <Animated.View style={[styles.mediaSkeleton, shimmerStyle]}>
                        {uploadStatus.thumbnailUri && !isVideo ? (
                            <Image
                                source={{ uri: uploadStatus.thumbnailUri }}
                                style={styles.thumbnail}
                                blurRadius={10}
                            />
                        ) : (
                            <View style={styles.iconContainer}>
                                <Ionicons
                                    name={isVideo ? 'videocam' : 'image'}
                                    size={32}
                                    color={colors.textTertiary}
                                />
                            </View>
                        )}

                        {/* Overlay with spinner and status */}
                        <View style={styles.overlay}>
                            <ActivityIndicator color={ACCENT} size="small" />
                            <Text style={styles.statusText}>{statusText}</Text>
                        </View>
                    </Animated.View>
                </LinearGradient>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'flex-end',
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    bubbleContainer: {
        maxWidth: '80%',
    },
    bubble: {
        borderRadius: radius.xl,
        borderTopRightRadius: radius.sm,
        overflow: 'hidden',
        minWidth: 200,
    },
    silkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 40,
    },
    mediaSkeleton: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    thumbnail: {
        ...StyleSheet.absoluteFillObject,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statusText: {
        color: colors.textSecondary,
        fontSize: 13,
    },
});

export default UploadProgress;
