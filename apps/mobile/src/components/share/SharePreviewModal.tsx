import { useRef, useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Platform,
    Linking,
    Share,
    useWindowDimensions,
    Image,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { colors, gradients, radius, typography, spacing, blur } from "../../theme";

const logo = require("../../../assets/logo.png");

const MAX_CARD_WIDTH = 340;

interface SharePreviewModalProps {
    visible: boolean;
    onClose: () => void;
    question: {
        text: string;
        partner_text?: string | null;
        is_two_part?: boolean;
    };
    packName?: string;
    cardColor?: string;
}

export function SharePreviewModal({
    visible,
    onClose,
    question,
    packName,
    cardColor,
}: SharePreviewModalProps) {
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = Math.min(screenWidth - 64, MAX_CARD_WIDTH);
    const shareViewRef = useRef<ViewShot>(null);
    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    // Capture the card when modal becomes visible
    useEffect(() => {
        if (visible && shareViewRef.current) {
            setIsCapturing(true);
            // Small delay to ensure the view is rendered
            const timer = setTimeout(async () => {
                try {
                    const uri = await shareViewRef.current?.capture?.();
                    if (uri) {
                        setCapturedUri(uri);
                    }
                } catch (error) {
                    console.error('Error capturing share image:', error);
                } finally {
                    setIsCapturing(false);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setCapturedUri(null);
        }
    }, [visible]);

    const handleInstagramShare = async () => {
        if (!capturedUri) return;

        try {
            // Check if Instagram is installed
            const instagramUrl = 'instagram://app';
            const canOpenInstagram = await Linking.canOpenURL(instagramUrl);

            if (canOpenInstagram && Platform.OS === 'ios') {
                // For iOS, we can use the Instagram Stories URL scheme
                // First, we need to copy the image to a location Instagram can access
                const base64 = await FileSystem.readAsStringAsync(capturedUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                // Use Instagram Stories URL scheme
                const instagramStoriesUrl = `instagram-stories://share?source_application=com.sauci.app`;

                // Try to open Instagram Stories with the image
                // Note: This requires the image to be in the pasteboard on iOS
                await Linking.openURL(instagramStoriesUrl);
            } else {
                // Fallback to regular sharing
                await handleMoreShare();
            }
        } catch (error) {
            console.error('Instagram share error:', error);
            // Fallback to regular sharing
            await handleMoreShare();
        }
    };

    const handleMessagesShare = async () => {
        if (!capturedUri) {
            // Fallback to text
            await Share.share({
                message: `${question.text}\n\nDiscover more on sauci.app`,
            });
            return;
        }

        try {
            // On iOS, we can share directly to Messages
            if (Platform.OS === 'ios') {
                await Sharing.shareAsync(capturedUri, {
                    mimeType: 'image/png',
                    UTI: 'public.png',
                });
            } else {
                await handleMoreShare();
            }
        } catch (error) {
            console.error('Messages share error:', error);
            await Share.share({
                message: `${question.text}\n\nDiscover more on sauci.app`,
            });
        }
    };

    const handleMoreShare = async () => {
        if (!capturedUri) {
            await Share.share({
                message: `${question.text}\n\nDiscover more on sauci.app`,
            });
            return;
        }

        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(capturedUri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Share this question',
                });
            } else {
                await Share.share({
                    message: `${question.text}\n\nDiscover more on sauci.app`,
                });
            }
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const useBlur = Platform.OS === 'ios';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Backdrop */}
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={StyleSheet.absoluteFill}
                >
                    {useBlur ? (
                        <BlurView
                            intensity={blur.heavy}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                        />
                    ) : (
                        <View style={styles.backdropFallback} />
                    )}
                </Animated.View>

                {/* Content */}
                <Animated.View
                    entering={SlideInDown.springify().damping(20)}
                    exiting={SlideOutDown.duration(200)}
                    style={[styles.content, { paddingTop: insets.top }]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <Ionicons name="close" size={28} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Share</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    {/* Card Preview */}
                    <View style={styles.previewContainer}>
                        <ViewShot
                            ref={shareViewRef}
                            options={{
                                format: 'png',
                                quality: 1,
                                result: 'tmpfile',
                            }}
                        >
                            <ShareableCard
                                question={question}
                                packName={packName}
                                cardWidth={cardWidth}
                                cardColor={cardColor}
                            />
                        </ViewShot>
                    </View>

                    {/* Share Actions */}
                    <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
                        <ShareActionButton
                            icon="logo-instagram"
                            label="Instagram"
                            colors={['#833AB4', '#FD1D1D', '#F77737']}
                            onPress={handleInstagramShare}
                            disabled={isCapturing}
                        />
                        <ShareActionButton
                            icon="chatbubble-ellipses"
                            label="Messages"
                            colors={['#34C759', '#30D158']}
                            onPress={handleMessagesShare}
                            disabled={isCapturing}
                        />
                        <ShareActionButton
                            icon="share-outline"
                            label="More"
                            colors={[colors.glass.backgroundLight, colors.glass.backgroundLight]}
                            onPress={handleMoreShare}
                            disabled={isCapturing}
                            isOutline
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

function ShareActionButton({
    icon,
    label,
    colors: buttonColors,
    onPress,
    disabled,
    isOutline,
}: {
    icon: string;
    label: string;
    colors: string[];
    onPress: () => void;
    disabled?: boolean;
    isOutline?: boolean;
}) {
    return (
        <TouchableOpacity
            style={styles.actionButton}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <View style={[
                styles.actionIconContainer,
                isOutline && styles.actionIconOutline,
            ]}>
                {!isOutline && (
                    <LinearGradient
                        colors={buttonColors as [string, string, ...string[]]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                )}
                <Ionicons
                    name={icon as any}
                    size={28}
                    color={colors.text}
                />
            </View>
            <Text style={styles.actionLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

function ShareableCard({
    question,
    packName,
    cardWidth,
    cardColor,
}: {
    question: {
        text: string;
        partner_text?: string | null;
        is_two_part?: boolean;
    };
    packName?: string;
    cardWidth: number;
    cardColor?: string;
}) {
    // Use the card color if provided, otherwise fall back to primary gradient
    const useGradient = !cardColor;

    return (
        <View style={[styles.shareableCard, { width: cardWidth }]}>
            {/* Background - solid color matching what the user saw, or gradient fallback */}
            {useGradient ? (
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
            ) : (
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: cardColor, borderRadius: radius.xl }
                    ]}
                />
            )}

            {/* Subtle overlay for depth */}
            <View style={styles.cardOverlay} />

            {/* Pack name badge */}
            {packName && (
                <View style={styles.packBadge}>
                    <Text style={styles.packBadgeText}>{packName}</Text>
                </View>
            )}

            {/* Content */}
            <View style={styles.shareableContent}>
                <Text style={[styles.questionText, question.is_two_part && styles.questionTextSmaller]}>
                    {question.text}
                </Text>

                {/* Partner's version of the question */}
                {question.partner_text && (
                    <View style={styles.partnerSection}>
                        <View style={styles.partnerDivider}>
                            <View style={styles.partnerDividerLine} />
                            <Text style={styles.partnerLabel}>Partner sees</Text>
                            <View style={styles.partnerDividerLine} />
                        </View>
                        <Text style={styles.partnerText}>{question.partner_text}</Text>
                    </View>
                )}
            </View>

            {/* Branding with logo */}
            <View style={styles.branding}>
                <Image source={logo} style={styles.brandingLogo} />
                <Text style={styles.brandingText}>sauci.app</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdropFallback: {
        flex: 1,
        backgroundColor: 'rgba(13, 13, 26, 0.95)',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    closeButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        ...typography.headline,
        color: colors.text,
        fontWeight: '600',
    },
    headerSpacer: {
        width: 44,
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xl,
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    actionButton: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    actionIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    actionIconOutline: {
        backgroundColor: colors.glass.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    actionLabel: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '500',
    },
    // Shareable card styles
    shareableCard: {
        aspectRatio: 0.7,
        borderRadius: radius.xl,
        overflow: 'hidden',
        padding: spacing.lg,
    },
    cardOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    packBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
    packBadgeText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '600',
    },
    shareableContent: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: spacing.xl,
    },
    questionText: {
        ...typography.title1,
        color: colors.text,
        fontWeight: '700',
        lineHeight: 36,
    },
    questionTextSmaller: {
        ...typography.title2,
        lineHeight: 30,
    },
    partnerSection: {
        marginTop: spacing.lg,
    },
    partnerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    partnerDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    partnerLabel: {
        ...typography.caption1,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '500',
    },
    partnerText: {
        ...typography.subhead,
        color: 'rgba(255, 255, 255, 0.8)',
        fontStyle: 'italic',
    },
    branding: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    brandingLogo: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    brandingText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: '600',
    },
});
