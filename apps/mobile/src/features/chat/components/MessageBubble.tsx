/**
 * MessageBubble - Wrapper component for chat message bubbles
 * Applies gradient styling for sender vs receiver messages.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors, gradients, spacing, radius } from '../../../theme';

const ACCENT_RGBA = 'rgba(212, 175, 55, ';

export interface MessageBubbleProps {
    isMe: boolean;
    index: number;
    children: React.ReactNode;
}

export function MessageBubble({ isMe, index, children }: MessageBubbleProps) {
    return (
        <Animated.View
            entering={FadeInUp.delay(index * 30).duration(200)}
            style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}
        >
            {isMe ? (
                <View style={styles.myBubbleContainer}>
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
                </View>
            ) : (
                <View style={styles.theirBubbleContainer}>
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
                </View>
            )}
        </Animated.View>
    );
}

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

export default MessageBubble;
