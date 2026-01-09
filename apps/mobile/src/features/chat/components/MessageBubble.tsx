/**
 * MessageBubble - Wrapper component for chat message bubbles
 * Applies gradient styling for sender vs receiver messages.
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors, gradients, spacing, radius } from '../../../theme';

const ACCENT_RGBA = 'rgba(212, 175, 55, ';

// Only animate the first few messages to avoid performance issues on large lists
const MAX_ANIMATED_INDEX = 5;

export interface MessageBubbleProps {
    isMe: boolean;
    index: number;
    children: React.ReactNode;
    /** Called when the message bubble is long pressed */
    onLongPress?: () => void;
}

const MessageBubbleComponent = ({ isMe, index, children, onLongPress }: MessageBubbleProps) => {
    // Only animate recent messages (low index in inverted list) to avoid performance issues
    const shouldAnimate = index < MAX_ANIMATED_INDEX;
    const enteringAnimation = shouldAnimate ? FadeInUp.duration(200) : undefined;

    const accessibilityLabel = isMe
        ? 'Your message. Long press for options'
        : "Partner's message. Long press for options";

    return (
        <Animated.View
            entering={enteringAnimation}
            style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}
        >
            {isMe ? (
                <TouchableOpacity
                    onLongPress={onLongPress}
                    activeOpacity={0.9}
                    delayLongPress={300}
                    style={styles.myBubbleContainer}
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    accessibilityHint="Long press to delete or report"
                >
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={[styles.bubble, styles.myBubble]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {/* Silk highlight */}
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.15)', 'transparent']}
                            style={styles.bubbleSilkHighlight}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                        {children}
                    </LinearGradient>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    onLongPress={onLongPress}
                    activeOpacity={0.9}
                    delayLongPress={300}
                    style={styles.theirBubbleContainer}
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    accessibilityHint="Long press to report"
                >
                    <View style={[styles.bubble, styles.theirBubble]}>
                        {/* Subtle gradient background */}
                        <LinearGradient
                            colors={['rgba(22, 33, 62, 0.6)', 'rgba(13, 13, 26, 0.8)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        {/* Silk highlight */}
                        <LinearGradient
                            colors={[`${ACCENT_RGBA}0.08)`, 'transparent']}
                            style={styles.bubbleSilkHighlight}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                        {children}
                    </View>
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};

// Wrap with React.memo for performance
export const MessageBubble = React.memo(MessageBubbleComponent);

const styles = StyleSheet.create({
    messageRow: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    myMessageRow: {
        justifyContent: 'flex-end',
    },
    theirMessageRow: {
        justifyContent: 'flex-start',
    },
    myBubbleContainer: {
        maxWidth: '80%',
    },
    theirBubbleContainer: {
        maxWidth: '80%',
    },
    bubble: {
        padding: spacing.md,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    myBubble: {
        borderTopRightRadius: radius.xs,
    },
    theirBubble: {
        borderTopLeftRadius: radius.xs,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.15)`,
    },
    bubbleSilkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 30,
    },
});
