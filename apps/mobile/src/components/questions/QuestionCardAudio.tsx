import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    interpolate,
    Easing,
    FadeInDown,
    FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadows, typography, spacing, animations } from "../../theme";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { SharePreviewModal } from "../share";

const ACTION_BUTTON_SIZE = 72;
const ACTION_BUTTON_OVERHANG_PERCENT = 0.5;
const actionButtonOffset = ACTION_BUTTON_SIZE * ACTION_BUTTON_OVERHANG_PERCENT;
const actionButtonBackground = colors.muted;

// Haptics helper - not supported on web
const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (Platform.OS === 'web') return;
    const Haptics = await import('expo-haptics');
    const feedbackStyle = style === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : style === 'heavy'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Medium;
    await Haptics.impactAsync(feedbackStyle);
};

export interface QuestionCardAudioProps {
    question: {
        id: string;
        text: string;
        intensity: number;
        partner_text?: string | null;
        partner_answered?: boolean;
        config?: { max_duration_seconds?: number };
    };
    packInfo?: { name: string; icon: string; color?: string } | null;
    onAnswer: (answer: 'yes' | 'skip', responseData?: { type: 'audio'; media_path: string; duration_seconds: number }) => void;
    onReport?: () => void;
}

export default function QuestionCardAudio({ question, packInfo, onAnswer, onReport }: QuestionCardAudioProps) {
    const [showShareModal, setShowShareModal] = useState(false);

    const maxDuration = question.config?.max_duration_seconds ?? 60;
    const { state, durationSeconds, recordingUri, startRecording, stopRecording, resetRecording } = useAudioRecorder({
        maxDurationSeconds: maxDuration,
    });

    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);

    const idleBreathing = useSharedValue(0);

    const handleSharePress = async () => {
        await triggerHaptic('light');
        setShowShareModal(true);
    };

    // Subtle idle breathing animation
    useEffect(() => {
        idleBreathing.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    // Cleanup sound on unmount
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const animatedStyle = useAnimatedStyle(() => {
        const idleOffset = interpolate(idleBreathing.value, [0, 1], [0, -4]);
        return {
            transform: [{ translateY: idleOffset }],
        };
    });

    const handleStartRecording = async () => {
        await triggerHaptic('medium');
        await startRecording();
    };

    const handleStopRecording = async () => {
        await triggerHaptic('light');
        await stopRecording();
    };

    const handlePlayPreview = async () => {
        if (!recordingUri) return;
        await triggerHaptic('light');

        if (isPlaying && sound) {
            await sound.pauseAsync();
            setIsPlaying(false);
            return;
        }

        if (sound) {
            await sound.playAsync();
            setIsPlaying(true);
            return;
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: recordingUri },
            { shouldPlay: true },
            (status) => {
                if (status.isLoaded) {
                    setPlaybackPosition(status.positionMillis / 1000);
                    if (status.didJustFinish) {
                        setIsPlaying(false);
                        setPlaybackPosition(0);
                    }
                }
            }
        );
        setSound(newSound);
        setIsPlaying(true);
    };

    const handleConfirm = async () => {
        if (!recordingUri) return;
        await triggerHaptic('medium');
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
        }
        onAnswer('yes', { type: 'audio', media_path: recordingUri, duration_seconds: durationSeconds });
    };

    const handleReRecord = async () => {
        await triggerHaptic('light');
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
        }
        setIsPlaying(false);
        setPlaybackPosition(0);
        resetRecording();
    };

    const handleCancel = async () => {
        await triggerHaptic('light');
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
        }
        setIsPlaying(false);
        setPlaybackPosition(0);
        resetRecording();
    };

    const handleSkip = async () => {
        await triggerHaptic('light');
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
        }
        onAnswer('skip');
    };

    const renderContent = () => {
        if (state === 'recording') {
            return (
                <RecordingContent
                    question={question}
                    packInfo={packInfo}
                    durationSeconds={durationSeconds}
                    maxDuration={maxDuration}
                    onStop={handleStopRecording}
                    onReport={onReport}
                />
            );
        }

        if (state === 'stopped' && recordingUri) {
            return (
                <PreviewContent
                    question={question}
                    packInfo={packInfo}
                    durationSeconds={durationSeconds}
                    isPlaying={isPlaying}
                    playbackPosition={playbackPosition}
                    onPlayPause={handlePlayPreview}
                    onConfirm={handleConfirm}
                    onReRecord={handleReRecord}
                    onCancel={handleCancel}
                    onReport={onReport}
                />
            );
        }

        return (
            <ReadyToRecordContent
                question={question}
                packInfo={packInfo}
                maxDuration={maxDuration}
                onRecord={handleStartRecording}
                onSkip={handleSkip}
                onReport={onReport}
                onSharePress={handleSharePress}
            />
        );
    };

    return (
        <>
            <Animated.View
                entering={FadeInDown.duration(400).springify()}
                style={styles.cardWrapper}
            >
                <Animated.View style={[styles.cardOuter, animatedStyle, shadows.lg, { shadowColor: colors.primary }]}>
                    <View
                        style={[
                            styles.gradientContainer, 
                            { backgroundColor: packInfo?.color || colors.background }
                        ]}
                    >
                        {renderContent()}
                    </View>
                </Animated.View>
            </Animated.View>

            <SharePreviewModal
                visible={showShareModal}
                onClose={() => setShowShareModal(false)}
                question={question}
                packName={packInfo?.name}
                cardColor={packInfo?.color}
            />
        </>
    );
}

// State A - Ready to record
function ReadyToRecordContent({
    question,
    packInfo,
    maxDuration,
    onRecord,
    onSkip,
    onReport,
    onSharePress,
}: {
    question: QuestionCardAudioProps['question'];
    packInfo?: { name: string; icon: string; color?: string } | null;
    maxDuration: number;
    onRecord: () => void;
    onSkip: () => void;
    onReport?: () => void;
    onSharePress: () => void;
}) {
    return (
        <View style={styles.cardInner}>
            {/* Header Row */}
            <View style={styles.headerRow}>
                {packInfo && (
                    <View style={styles.packBadge}>
                        <Ionicons name={packInfo.icon as any} size={14} color={colors.text} />
                        <Text style={styles.packBadgeText} numberOfLines={1}>
                            {packInfo.name}
                        </Text>
                    </View>
                )}
                {!packInfo && <View style={styles.headerSpacer} />}

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={onSharePress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                    {onReport && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onReport}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="flag-outline" size={20} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.text}>
                    {question.text}
                </Text>

                <View style={styles.waveformPlaceholder}>
                    <Ionicons name="mic-outline" size={48} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.durationLimitText}>Up to {maxDuration} seconds</Text>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.audioButtonContainer}>
                    {/* Left - No/Skip */}
                    <TouchableOpacity
                        onPress={onSkip}
                        style={styles.circleActionButton}
                    >
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: actionButtonBackground, borderRadius: 36 }]} />
                        <Ionicons name="close" size={32} color={colors.error} style={styles.buttonIcon} />
                    </TouchableOpacity>

                    {/* Middle - Skip (Label) */}
                    <TouchableOpacity
                        style={styles.skipButtonCenter}
                        onPress={onSkip}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    {/* Right - Record */}
                    <RecordButton onPress={onRecord} />
                </View>
            </View>
        </View>
    );
}

// State B - Recording
function RecordingContent({
    question,
    packInfo,
    durationSeconds,
    maxDuration,
    onStop,
    onReport,
}: {
    question: QuestionCardAudioProps['question'];
    packInfo?: { name: string; icon: string } | null;
    durationSeconds: number;
    maxDuration: number;
    onStop: () => void;
    onReport?: () => void;
}) {
    const pulseAnim = useSharedValue(0);

    useEffect(() => {
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnim.value, [0, 1], [0.6, 1]),
        transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.1]) }],
    }));

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.cardInner}>
            {/* Header Row */}
            <View style={styles.headerRow}>
                {packInfo && (
                    <View style={styles.packBadge}>
                        <Ionicons name={packInfo.icon as any} size={14} color={colors.text} />
                        <Text style={styles.packBadgeText} numberOfLines={1}>
                            {packInfo.name}
                        </Text>
                    </View>
                )}
                {!packInfo && <View style={styles.headerSpacer} />}

                <View style={styles.headerActions}>
                    {onReport && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onReport}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="flag-outline" size={20} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.previewText} numberOfLines={2}>
                    {question.text}
                </Text>

                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.recordingIndicatorContainer}
                >
                    <View style={styles.recordingHeader}>
                        <Animated.View style={[styles.recordingDot, pulseStyle]} />
                        <Text style={styles.recordingText}>Recording</Text>
                    </View>

                    <Text style={styles.recordingTimer}>{formatTime(durationSeconds)}</Text>

                    <AudioLevelBars isActive={true} />

                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBackground}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${(durationSeconds / maxDuration) * 100}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>
                            {formatTime(maxDuration - durationSeconds)} remaining
                        </Text>
                    </View>
                </Animated.View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.centerButtonContainer}>
                    <StopButton onPress={onStop} />
                </View>
            </View>
        </View>
    );
}

// State C - Preview
function PreviewContent({
    question,
    packInfo,
    durationSeconds,
    isPlaying,
    playbackPosition,
    onPlayPause,
    onConfirm,
    onReRecord,
    onCancel,
    onReport,
}: {
    question: QuestionCardAudioProps['question'];
    packInfo?: { name: string; icon: string } | null;
    durationSeconds: number;
    isPlaying: boolean;
    playbackPosition: number;
    onPlayPause: () => void;
    onConfirm: () => void;
    onReRecord: () => void;
    onCancel: () => void;
    onReport?: () => void;
}) {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.cardInner}>
            {/* Header Row */}
            <View style={styles.headerRow}>
                {packInfo && (
                    <View style={styles.packBadge}>
                        <Ionicons name={packInfo.icon as any} size={14} color={colors.text} />
                        <Text style={styles.packBadgeText} numberOfLines={1}>
                            {packInfo.name}
                        </Text>
                    </View>
                )}
                {!packInfo && <View style={styles.headerSpacer} />}

                <View style={styles.headerActions}>
                    {onReport && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onReport}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="flag-outline" size={20} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            <View style={styles.previewContent}>
                <Text style={styles.previewText} numberOfLines={2}>
                    {question.text}
                </Text>

                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.playbackContainer}
                >
                    <PlayPauseButton isPlaying={isPlaying} onPress={onPlayPause} />

                    <View style={styles.playbackWaveform}>
                        <AudioLevelBars isActive={isPlaying} />
                    </View>

                    <View style={styles.playbackDuration}>
                        <Text style={styles.playbackTimeText}>
                            {formatTime(playbackPosition)} / {formatTime(durationSeconds)}
                        </Text>
                    </View>
                </Animated.View>
            </View>

            {/* Footer */}
            <View style={styles.previewFooter}>
                <View style={styles.previewButtonRow}>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={onCancel}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <ConfirmButton onPress={onConfirm} />

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={onReRecord}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.secondaryButtonText}>Re-record</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// Audio level visualization component
function AudioLevelBars({ isActive }: { isActive: boolean }) {
    const bars = 5;
    const barAnimations = Array.from({ length: bars }, () => useSharedValue(0.3));

    useEffect(() => {
        if (isActive) {
            barAnimations.forEach((anim, index) => {
                const delay = index * 100;
                anim.value = withRepeat(
                    withSequence(
                        withTiming(Math.random() * 0.5 + 0.5, {
                            duration: 200 + Math.random() * 200,
                            easing: Easing.inOut(Easing.sin)
                        }),
                        withTiming(Math.random() * 0.3 + 0.2, {
                            duration: 200 + Math.random() * 200,
                            easing: Easing.inOut(Easing.sin)
                        })
                    ),
                    -1,
                    true
                );
            });
        } else {
            barAnimations.forEach((anim) => {
                anim.value = withTiming(0.3, { duration: 300 });
            });
        }
    }, [isActive]);

    return (
        <View style={styles.audioLevelContainer}>
            {barAnimations.map((anim, index) => {
                const barStyle = useAnimatedStyle(() => ({
                    height: interpolate(anim.value, [0, 1], [8, 40]),
                }));

                return (
                    <Animated.View
                        key={index}
                        style={[styles.audioLevelBar, barStyle]}
                    />
                );
            })}
        </View>
    );
}

// Record button component
function RecordButton({ onPress }: { onPress: () => void }) {
    const buttonScale = useSharedValue(1);
    const buttonGlow = useSharedValue(0);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, animations.spring);
        buttonGlow.value = withTiming(1, { duration: 150 });
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, animations.spring);
        buttonGlow.value = withTiming(0, { duration: 200 });
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
        shadowOpacity: interpolate(buttonGlow.value, [0, 1], [0.3, 0.6]),
        shadowRadius: interpolate(buttonGlow.value, [0, 1], [8, 16]),
    }));

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            style={styles.recordButtonWrapper}
        >
            <Animated.View style={[
                styles.recordButton,
                buttonAnimatedStyle,
                { backgroundColor: actionButtonBackground }
            ]}>
                <Ionicons
                    name="mic"
                    size={32}
                    color="#FFFFFF"
                    style={styles.buttonIcon}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

// Stop button component
function StopButton({ onPress }: { onPress: () => void }) {
    const buttonScale = useSharedValue(1);
    const pulseAnim = useSharedValue(0);

    useEffect(() => {
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, animations.spring);
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, animations.spring);
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulseAnim.value, [0, 1], [0.3, 0.6]),
        transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.3]) }],
    }));

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <View style={styles.stopButtonContainer}>
                <Animated.View style={[styles.stopButtonGlow, glowStyle]} />
                <Animated.View style={[styles.stopButton, buttonAnimatedStyle]}>
                    <LinearGradient
                        colors={gradients.error as [string, string]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.stopIcon} />
                </Animated.View>
            </View>
        </TouchableOpacity>
    );
}

// Play/Pause button component
function PlayPauseButton({ isPlaying, onPress }: { isPlaying: boolean; onPress: () => void }) {
    const buttonScale = useSharedValue(1);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, animations.spring);
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, animations.spring);
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Animated.View style={[styles.playPauseButton, buttonAnimatedStyle]}>
                <LinearGradient
                    colors={['#ffffff', '#f0f0f0']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={28}
                    color={colors.primary}
                    style={styles.buttonIcon}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

// Confirm button component
function ConfirmButton({ onPress }: { onPress: () => void }) {
    const buttonScale = useSharedValue(1);
    const buttonGlow = useSharedValue(0);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, animations.spring);
        buttonGlow.value = withTiming(1, { duration: 150 });
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, animations.spring);
        buttonGlow.value = withTiming(0, { duration: 200 });
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
        shadowOpacity: interpolate(buttonGlow.value, [0, 1], [0.3, 0.6]),
        shadowRadius: interpolate(buttonGlow.value, [0, 1], [8, 16]),
    }));

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Animated.View style={[
                styles.confirmButton,
                buttonAnimatedStyle,
                { backgroundColor: colors.success }
            ]}>
                <LinearGradient
                    colors={gradients.success as [string, string]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <Ionicons
                    name="checkmark"
                    size={28}
                    color={colors.text}
                    style={styles.buttonIcon}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        width: "90%",
        maxWidth: 400,
        flex: 1,
        maxHeight: 580 - actionButtonOffset, // Account for button overhang
    },
    cardOuter: {
        flex: 1,
        borderRadius: radius.xxl,
        overflow: "visible",
    },
    gradientContainer: {
        flex: 1,
        borderRadius: radius.xxl,
        overflow: "visible",
    },
    cardInner: {
        flex: 1,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    // Header row styles
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerSpacer: {
        flex: 1,
    },
    packBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.xs,
        maxWidth: '60%',
    },
    packBadgeText: {
        ...typography.caption1,
        fontWeight: '600',
        color: colors.text,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Content styles
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.sm,
    },
    text: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
        lineHeight: 36,
    },
    waveformPlaceholder: {
        marginTop: spacing.xl,
        alignItems: 'center',
        gap: spacing.sm,
    },
    durationLimitText: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.5)',
    },
    // Footer styles
    footer: {
        paddingTop: spacing.md,
        transform: [{ translateY: actionButtonOffset }],
    },
    previewFooter: {
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
    },
    audioButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        width: '100%',
        paddingHorizontal: spacing.md,
    },
    centerButtonContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: spacing.sm,
    },
    skipButtonCenter: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: 30, // Align above center of 72px buttons
    },
    skipText: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
    },
    circleActionButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    recordButtonWrapper: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    recordButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    buttonIcon: {
        zIndex: 1,
    },
    // Recording state styles
    recordingIndicatorContainer: {
        alignItems: 'center',
        gap: spacing.lg,
    },
    recordingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.error,
    },
    recordingText: {
        ...typography.headline,
        color: colors.error,
        fontWeight: '600',
    },
    recordingTimer: {
        ...typography.largeTitle,
        color: colors.text,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    },
    progressBarContainer: {
        width: '100%',
        alignItems: 'center',
        gap: spacing.xs,
    },
    progressBarBackground: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: radius.full,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.text,
        borderRadius: radius.full,
    },
    progressText: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.6)',
    },
    stopButtonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopButtonGlow: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.error,
    },
    stopButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    stopIcon: {
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: colors.text,
        zIndex: 1,
    },
    // Preview state styles
    previewContent: {
        flex: 1,
        paddingTop: spacing.sm,
    },
    previewText: {
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.lg,
    },
    playbackContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
    },
    playPauseButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    playbackWaveform: {
        width: '100%',
        paddingHorizontal: spacing.xl,
    },
    playbackDuration: {
        alignItems: 'center',
    },
    playbackTimeText: {
        ...typography.subhead,
        color: 'rgba(255,255,255,0.7)',
        fontVariant: ['tabular-nums'],
    },
    audioLevelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        gap: spacing.sm,
    },
    audioLevelBar: {
        width: 6,
        backgroundColor: colors.text,
        borderRadius: radius.full,
    },
    previewButtonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    secondaryButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.xs,
    },
    secondaryButtonText: {
        ...typography.caption1,
        color: 'rgba(255,255,255,0.7)',
    },
    confirmButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
});
