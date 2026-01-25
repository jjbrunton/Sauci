import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DecorativeSeparator } from '../../../components/ui';
import { colors, gradients, spacing, radius, typography } from '../../../theme';
import { Match } from '../types';
import { ResponseData } from '@sauci/shared';
import { getCachedSignedUrl, getStoragePath } from '../../../lib/imageCache';

// Premium color palette
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = 'rgba(212, 175, 55, ';

interface MatchCardProps {
    match: Match | null;
    user: { id: string } | null;
    userName?: string;
    partnerName?: string;
    onImagePress?: (uri: string) => void;
}

/**
 * Helper function to get display text for who_likely choices
 */
function getChoiceDisplay(chosenUserId: string, userId: string, userName: string, partnerName: string): string {
    return chosenUserId === userId ? userName : partnerName;
}

/**
 * Component to render text_answer response summary
 */
const TextAnswerDisplay: React.FC<{
    responseSummary: Record<string, ResponseData>;
    userId: string;
    partnerName: string;
}> = ({ responseSummary, userId, partnerName }) => {
    const entries = Object.entries(responseSummary);

    return (
        <View style={styles.responseSummaryContainer}>
            {entries.map(([responderId, data]) => {
                if (data.type !== 'text_answer') return null;
                const isUser = responderId === userId;
                const name = isUser ? 'You' : partnerName;

                return (
                    <View key={responderId} style={styles.textResponseCard}>
                        <Text style={styles.textResponseName}>{name}</Text>
                        <View style={[
                            styles.textBubble,
                            isUser ? styles.textBubbleUser : styles.textBubblePartner
                        ]}>
                            <Text style={styles.textBubbleText}>"{data.text}"</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

/**
 * Component to render photo response summary
 */
const PhotoDisplay: React.FC<{
    responseSummary: Record<string, ResponseData>;
    userId: string;
    partnerName: string;
    onImagePress?: (uri: string) => void;
}> = ({ responseSummary, userId, partnerName, onImagePress }) => {
    const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
    const [loadingUrls, setLoadingUrls] = useState(true);
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchPhotoUrls = async () => {
            // Fetch all signed URLs in parallel for faster loading
            const photoEntries: Array<[string, { type: 'photo'; media_path: string }]> = [];
            for (const [responderId, data] of Object.entries(responseSummary)) {
                if (data.type === 'photo') {
                    photoEntries.push([responderId, data]);
                }
            }

            const urlPromises = photoEntries.map(async ([responderId, data]) => {
                try {
                    const storagePath = getStoragePath(data.media_path);
                    const signedUrl = await getCachedSignedUrl(storagePath, 'response-media');
                    return { responderId, signedUrl };
                } catch (err) {
                    console.error('Failed to get photo URL:', err);
                    return { responderId, signedUrl: null };
                }
            });

            const results = await Promise.all(urlPromises);
            const urls: Record<string, string> = {};

            // Collect URLs and prefetch images
            const prefetchPromises: Promise<boolean>[] = [];
            for (const { responderId, signedUrl } of results) {
                if (signedUrl) {
                    urls[responderId] = signedUrl;
                    // Prefetch image for faster display
                    prefetchPromises.push(Image.prefetch(signedUrl));
                }
            }

            // Set URLs immediately, prefetch in background
            setPhotoUrls(urls);
            setLoadingUrls(false);

            // Initialize loading state for each image
            const initialLoading: Record<string, boolean> = {};
            for (const responderId of Object.keys(urls)) {
                initialLoading[responderId] = true;
            }
            setLoadingImages(initialLoading);

            // Wait for prefetch to complete (non-blocking)
            Promise.all(prefetchPromises).catch(() => {
                // Prefetch failures are non-critical
            });
        };

        fetchPhotoUrls();
    }, [responseSummary]);

    const handleImageLoad = (responderId: string) => {
        setLoadingImages(prev => ({ ...prev, [responderId]: false }));
    };

    const entries = Object.entries(responseSummary);

    return (
        <View style={styles.photoContainer}>
            {entries.map(([responderId, data]) => {
                if (data.type !== 'photo') return null;
                const isUser = responderId === userId;
                const name = isUser ? 'You' : partnerName;
                const photoUrl = photoUrls[responderId];
                const isImageLoading = loadingImages[responderId];

                return (
                    <View key={responderId} style={styles.photoCard}>
                        <Text style={styles.photoName}>{name}</Text>
                        <TouchableOpacity
                            style={styles.photoThumbnailContainer}
                            onPress={() => photoUrl && onImagePress?.(photoUrl)}
                            disabled={!photoUrl}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`View ${name}'s photo full screen`}
                        >
                            {loadingUrls ? (
                                <View style={styles.photoPlaceholder}>
                                    <ActivityIndicator size="small" color={colors.premium.gold} />
                                </View>
                            ) : photoUrl ? (
                                <>
                                    <Image
                                        source={{ uri: photoUrl }}
                                        style={styles.photoThumbnail}
                                        contentFit="cover"
                                        cachePolicy="disk"
                                        transition={200}
                                        onLoad={() => handleImageLoad(responderId)}
                                    />
                                    {isImageLoading && (
                                        <View style={styles.photoLoadingOverlay}>
                                            <ActivityIndicator size="small" color={colors.premium.gold} />
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

/**
 * Component to render who_likely response summary
 */
const WhoLikelyDisplay: React.FC<{
    responseSummary: Record<string, ResponseData>;
    userId: string;
    userName: string;
    partnerName: string;
}> = ({ responseSummary, userId, userName, partnerName }) => {
    const entries = Object.entries(responseSummary);

    return (
        <View style={styles.whoLikelyContainer}>
            {entries.map(([responderId, data]) => {
                if (data.type !== 'who_likely') return null;
                const isUser = responderId === userId;
                const voterName = isUser ? 'You' : partnerName;
                const choiceName = getChoiceDisplay(data.chosen_user_id, userId, userName, partnerName);

                return (
                    <View key={responderId} style={styles.whoLikelyCard}>
                        <Text style={styles.whoLikelyVoter}>{voterName} chose:</Text>
                        <LinearGradient
                            colors={gradients.premiumRose as [string, string]}
                            style={styles.whoLikelyChoiceBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.whoLikelyChoiceText}>{choiceName}</Text>
                        </LinearGradient>
                    </View>
                );
            })}
        </View>
    );
};

/**
 * Component to render audio response summary
 */
const AudioDisplay: React.FC<{
    responseSummary: Record<string, ResponseData>;
    userId: string;
    partnerName: string;
}> = ({ responseSummary, userId, partnerName }) => {
    const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [sounds, setSounds] = useState<Record<string, Audio.Sound>>({});

    useEffect(() => {
        const fetchAudioUrls = async () => {
            const urls: Record<string, string> = {};

            for (const [responderId, data] of Object.entries(responseSummary)) {
                if (data.type === 'audio' && data.media_path) {
                    try {
                        const storagePath = getStoragePath(data.media_path);
                        const signedUrl = await getCachedSignedUrl(storagePath, 'response-media');

                        if (signedUrl) {
                            urls[responderId] = signedUrl;
                        }
                    } catch (err) {
                        console.error('Failed to get audio URL:', err);
                    }
                }
            }

            setAudioUrls(urls);
        };

        fetchAudioUrls();

        // Cleanup sounds on unmount
        return () => {
            Object.values(sounds).forEach(sound => {
                sound.unloadAsync();
            });
        };
    }, [responseSummary]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = async (responderId: string) => {
        const audioUrl = audioUrls[responderId];
        if (!audioUrl) return;

        // If already playing this one, pause it
        if (playingId === responderId && sounds[responderId]) {
            await sounds[responderId].pauseAsync();
            setPlayingId(null);
            return;
        }

        // Stop any currently playing audio
        if (playingId && sounds[playingId]) {
            await sounds[playingId].stopAsync();
        }

        // Play the selected audio
        try {
            let sound = sounds[responderId];
            if (!sound) {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: false },
                    (status) => {
                        if (status.isLoaded && status.didJustFinish) {
                            setPlayingId(null);
                        }
                    }
                );
                sound = newSound;
                setSounds(prev => ({ ...prev, [responderId]: sound }));
            }
            await sound.playFromPositionAsync(0);
            setPlayingId(responderId);
        } catch (err) {
            console.error('Failed to play audio:', err);
        }
    };

    const entries = Object.entries(responseSummary);

    return (
        <View style={styles.audioContainer}>
            {entries.map(([responderId, data]) => {
                if (data.type !== 'audio') return null;
                const isUser = responderId === userId;
                const name = isUser ? 'You' : partnerName;
                const audioUrl = audioUrls[responderId];
                const isPlaying = playingId === responderId;

                return (
                    <View key={responderId} style={styles.audioCard}>
                        <Text style={styles.audioName}>{name}</Text>
                        <TouchableOpacity
                            style={styles.audioPlayer}
                            onPress={() => handlePlayPause(responderId)}
                            disabled={!audioUrl}
                        >
                            <View style={[
                                styles.audioPlayButton,
                                isPlaying && styles.audioPlayButtonActive
                            ]}>
                                <Ionicons
                                    name={isPlaying ? 'pause' : 'play'}
                                    size={20}
                                    color={colors.text}
                                />
                            </View>
                            <View style={styles.audioWaveform}>
                                {[...Array(5)].map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.audioBar,
                                            { height: 8 + (i % 3) * 8 },
                                            isPlaying && styles.audioBarActive
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={styles.audioDuration}>
                                {formatDuration(data.duration_seconds)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

const MatchCardComponent: React.FC<MatchCardProps> = ({ match, user, userName = 'You', partnerName = 'Partner', onImagePress }) => {
    // Track if animation has already played to prevent re-animation on re-renders
    const hasAnimatedRef = useRef(false);
    const shouldAnimate = !hasAnimatedRef.current;

    // Mark as animated after first render
    if (!hasAnimatedRef.current) {
        hasAnimatedRef.current = true;
    }
    if (!match?.question) return null;

    const isYesYes = match?.match_type === 'yes_yes';
    const isBothAnswered = match?.match_type === 'both_answered';

    // Determine the response type from response_summary
    const getResponseType = (): ResponseData['type'] | null => {
        if (!match.response_summary) return null;
        const firstResponse = Object.values(match.response_summary)[0];
        return firstResponse?.type || null;
    };

    const responseType = getResponseType();

    // Only animate on first render to prevent re-animation when list re-renders
    const enteringAnimation = shouldAnimate
        ? FadeInDown.delay(100).duration(400).springify()
        : undefined;

    return (
        <Animated.View
            entering={enteringAnimation}
            style={styles.matchCardContainer}
        >
            <View style={styles.matchCard}>
                {/* Card gradient background - removed for flat style
                <LinearGradient
                    colors={isYesYes
                        ? ['rgba(212, 175, 55, 0.12)', 'rgba(184, 134, 11, 0.08)']
                        : ['rgba(232, 164, 174, 0.1)', 'rgba(22, 33, 62, 0.6)']
                    }
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                */}

                {/* Top glow for YES+YES - removed
                {isYesYes && (
                    <LinearGradient
                        colors={[`${ACCENT_RGBA}0.15)`, 'transparent']}
                        style={styles.matchCardGlow}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />
                )}
                */}

                {/* Match Label */}
                <Text style={[styles.matchLabel, isYesYes && styles.matchLabelYesYes]}>
                    {isYesYes ? "PERFECT MATCH" : isBothAnswered ? "BOTH ANSWERED" : "SOFT MATCH"}
                </Text>

                {/* Decorative Separator */}
                <DecorativeSeparator
                    variant={isYesYes ? "gold" : "rose"}
                    width="60%"
                    marginVertical={spacing.md}
                />

                {/* Question and Responses - Show based on match type and response type */}
                {isBothAnswered && match.response_summary && responseType ? (
                    // Render response summary for non-swipe question types
                    <View style={styles.responseSummaryWrapper}>
                        {/* Show the question text */}
                        <Text style={styles.matchQuestionText}>
                            "{match.question.text}"
                        </Text>

                        <DecorativeSeparator
                            variant="rose"
                            width="40%"
                            marginVertical={spacing.sm}
                        />

                        {/* Render based on response type */}
                        {responseType === 'text_answer' && (
                            <TextAnswerDisplay
                                responseSummary={match.response_summary}
                                userId={user?.id || ''}
                                partnerName={partnerName}
                            />
                        )}

                        {responseType === 'photo' && (
                            <PhotoDisplay
                                responseSummary={match.response_summary}
                                userId={user?.id || ''}
                                partnerName={partnerName}
                                onImagePress={onImagePress}
                            />
                        )}

                        {responseType === 'audio' && (
                            <AudioDisplay
                                responseSummary={match.response_summary}
                                userId={user?.id || ''}
                                partnerName={partnerName}
                            />
                        )}

                        {responseType === 'who_likely' && (
                            <WhoLikelyDisplay
                                responseSummary={match.response_summary}
                                userId={user?.id || ''}
                                userName={userName}
                                partnerName={partnerName}
                            />
                        )}
                    </View>
                ) : match.responses && match.responses.length > 0 ? (
                    <View style={styles.responsesContainer}>
                        {(() => {
                            // Sort responses by created_at to determine who answered first
                            const sortedResponses = [...match.responses].sort(
                                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                            );
                            const isTwoPart = !!match.question?.partner_text;

                            return sortedResponses.map((response, index) => {
                                const isUser = response.user_id === user?.id;
                                const isYes = response.answer === 'yes';
                                const name = isUser ? 'You' : (response.profiles?.name?.split(' ')[0] || 'Partner');

                                // First responder sees main text, second sees partner_text
                                const questionText = isTwoPart && index === 1
                                    ? match.question?.partner_text
                                    : match.question?.text;

                                return (
                                    <View key={response.user_id} style={styles.responseCard}>
                                        {/* Name and Answer Badge */}
                                        <View style={styles.responseHeader}>
                                            <Text style={styles.responseName}>{name}</Text>
                                            {isYes ? (
                                                <LinearGradient
                                                    colors={isYesYes
                                                        ? gradients.premiumGold as [string, string]
                                                        : [colors.success, '#27ae60']
                                                    }
                                                    style={styles.answerBadge}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <Ionicons name="checkmark" size={10} color={colors.text} />
                                                    <Text style={styles.answerBadgeText}>YES</Text>
                                                </LinearGradient>
                                            ) : (
                                                <View style={styles.answerBadgeMaybe}>
                                                    <Ionicons name="help" size={10} color={colors.warning} />
                                                    <Text style={styles.answerBadgeTextMaybe}>MAYBE</Text>
                                                </View>
                                            )}
                                        </View>
                                        {/* Question they saw */}
                                        <Text style={styles.responseQuestionText}>
                                            "{questionText}"
                                        </Text>
                                    </View>
                                );
                            });
                        })()}
                    </View>
                ) : (
                    <Text style={styles.matchQuestionText}>
                        "{match.question.text}"
                    </Text>
                )}

                {/* Premium border removed */}
            </View>
        </Animated.View>
    );
};

// ...

const styles = StyleSheet.create({
    matchCardContainer: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundLight,
    },
    matchCard: {
        borderRadius: radius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: colors.backgroundLight,
    },
    matchCardGlow: {
        display: 'none',
    },
    // ...
    responseCard: {
        backgroundColor: colors.background, // Nested
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    matchCardBorder: {
        display: 'none',
    },
    matchCardBorderYesYes: {
        display: 'none',
    },
    // ...
    textBubbleUser: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.primary,
        alignSelf: 'flex-end',
    },
    textBubblePartner: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        alignSelf: 'flex-start',
    },
    // ...
    photoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ...
    whoLikelyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: radius.lg,
        padding: spacing.sm,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    audioPlayButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.backgroundLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },


    matchLabel: {
        ...typography.caption2,
        fontWeight: '700',
        letterSpacing: 2,
        color: colors.premium.rose,
        marginBottom: spacing.xs,
    },
    matchLabelYesYes: {
        color: ACCENT,
    },
    matchQuestionText: {
        ...typography.subhead,
        color: colors.text,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    responsesContainer: {
        width: '100%',
        gap: spacing.sm,
    },

    responseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    responseName: {
        ...typography.caption1,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    answerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        gap: 3,
        borderRadius: radius.full,
    },
    answerBadgeText: {
        ...typography.caption2,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 0.5,
    },
    answerBadgeMaybe: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        gap: 3,
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(243, 156, 18, 0.3)',
        borderRadius: radius.full,
    },
    answerBadgeTextMaybe: {
        ...typography.caption2,
        fontWeight: '700',
        color: colors.warning,
        letterSpacing: 0.5,
    },
    responseQuestionText: {
        ...typography.footnote,
        color: colors.text,
        fontStyle: 'italic',
        lineHeight: 18,
    },



    // Response summary styles for non-swipe question types
    responseSummaryWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    responseSummaryContainer: {
        width: '100%',
        gap: spacing.sm,
    },

    // Text answer styles
    textResponseCard: {
        width: '100%',
        gap: spacing.xs,
    },
    textResponseName: {
        ...typography.caption2,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    textBubble: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        maxWidth: '100%',
    },


    textBubbleText: {
        ...typography.subhead,
        color: colors.text,
        fontStyle: 'italic',
        lineHeight: 20,
    },

    // Photo styles
    photoContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        width: '100%',
    },
    photoCard: {
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
        maxWidth: 120,
    },
    photoName: {
        ...typography.caption2,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    photoThumbnailContainer: {
        width: 80,
        height: 80,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(232, 164, 174, 0.3)',
    },
    photoThumbnail: {
        width: '100%',
        height: '100%',
    },
    photoLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },


    // Who likely styles
    whoLikelyContainer: {
        width: '100%',
        gap: spacing.sm,
    },

    whoLikelyVoter: {
        ...typography.caption1,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    whoLikelyChoiceBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
    whoLikelyChoiceText: {
        ...typography.caption1,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 0.5,
    },
    // Audio display styles
    audioContainer: {
        width: '100%',
        gap: spacing.md,
    },
    audioCard: {
        width: '100%',
        gap: spacing.xs,
    },
    audioName: {
        ...typography.caption1,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
    },


    audioPlayButtonActive: {
        backgroundColor: colors.primary,
    },
    audioWaveform: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        height: 32,
    },
    audioBar: {
        width: 4,
        backgroundColor: 'rgba(232, 164, 174, 0.3)',
        borderRadius: radius.full,
    },
    audioBarActive: {
        backgroundColor: colors.primary,
    },
    audioDuration: {
        ...typography.caption1,
        color: colors.textTertiary,
        fontVariant: ['tabular-nums'],
        minWidth: 35,
        textAlign: 'right',
    },
});

export { MatchCardComponent as MatchCard };
