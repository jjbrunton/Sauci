import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { colors, gradients, spacing, radius, typography } from '../../../theme';

export interface InputBarProps {
    inputText: string;
    uploading: boolean;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onPickMedia: () => void;
    onTakePhoto: () => void;
    onRecordVideo: () => void;
}

const ACCENT = colors.premium.gold;

/**
 * Chat input bar with expandable media menu.
 * Includes text input, send button, and media action buttons.
 */
const InputBarComponent: React.FC<InputBarProps> = ({
    inputText,
    uploading,
    onChangeText,
    onSend,
    onPickMedia,
    onTakePhoto,
    onRecordVideo,
}) => {
    const [menuExpanded, setMenuExpanded] = useState(false);
    const menuWidth = useSharedValue(0);
    const buttonRotation = useSharedValue(0);

    const toggleMenu = () => {
        const newExpanded = !menuExpanded;
        setMenuExpanded(newExpanded);
        menuWidth.value = withTiming(newExpanded ? 132 : 0, { duration: 200, easing: Easing.out(Easing.ease) });
        buttonRotation.value = withTiming(newExpanded ? 45 : 0, { duration: 200, easing: Easing.out(Easing.ease) });
    };

    const handleMediaAction = (action: () => void) => {
        setMenuExpanded(false);
        menuWidth.value = withTiming(0, { duration: 150 });
        buttonRotation.value = withTiming(0, { duration: 150 });
        action();
    };

    const menuAnimatedStyle = useAnimatedStyle(() => ({
        width: menuWidth.value,
        opacity: interpolate(menuWidth.value, [0, 132], [0, 1]),
    }));

    const plusButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${buttonRotation.value}deg` }],
    }));

    const sendDisabled = !inputText.trim();
    const mediaDisabled = uploading;

    return (
        <View style={styles.container}>
            {/* Plus button to toggle media menu */}
            <TouchableOpacity
                onPress={toggleMenu}
                disabled={mediaDisabled}
                style={styles.attachButton}
                accessibilityRole="button"
                accessibilityLabel="Toggle media menu"
                testID="chat-input-toggle-media"
            >
                {uploading ? (
                    <ActivityIndicator color={ACCENT} size="small" />
                ) : (
                    <Animated.View style={[styles.attachButtonInner, styles.plusButton, plusButtonAnimatedStyle]}>
                        <Ionicons name="add" size={24} color={ACCENT} />
                    </Animated.View>
                )}
            </TouchableOpacity>

            {/* Expandable media options */}
            <Animated.View style={[styles.mediaMenuContainer, menuAnimatedStyle]}>
                <TouchableOpacity
                    onPress={() => handleMediaAction(onTakePhoto)}
                    style={styles.mediaMenuItem}
                    activeOpacity={0.7}
                    disabled={mediaDisabled}
                    accessibilityRole="button"
                    accessibilityLabel="Take photo"
                    testID="chat-input-take-photo"
                >
                    <View style={styles.mediaMenuItemInner}>
                        <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleMediaAction(onRecordVideo)}
                    style={styles.mediaMenuItem}
                    activeOpacity={0.7}
                    disabled={mediaDisabled}
                    accessibilityRole="button"
                    accessibilityLabel="Record video"
                    testID="chat-input-record-video"
                >
                    <View style={styles.mediaMenuItemInner}>
                        <Ionicons name="videocam-outline" size={20} color={colors.textSecondary} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleMediaAction(onPickMedia)}
                    style={styles.mediaMenuItem}
                    activeOpacity={0.7}
                    disabled={mediaDisabled}
                    accessibilityRole="button"
                    accessibilityLabel="Pick media"
                    testID="chat-input-pick-media"
                >
                    <View style={styles.mediaMenuItemInner}>
                        <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                    </View>
                </TouchableOpacity>
            </Animated.View>

            <View style={styles.inputFieldWrapper}>
                {/* Subtle gradient border effect */}
                <View style={styles.inputFieldBorder} />
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={onChangeText}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                />
            </View>

            <TouchableOpacity
                onPress={onSend}
                disabled={sendDisabled}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                testID="chat-input-send"
            >
                <LinearGradient
                    colors={sendDisabled ? ['rgba(22, 33, 62, 0.6)', 'rgba(22, 33, 62, 0.6)'] : gradients.primary as [string, string]}
                    style={styles.sendButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Silk highlight */}
                    {!sendDisabled && (
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.2)', 'transparent']}
                            style={styles.sendButtonHighlight}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                    )}
                    <Ionicons
                        name="send"
                        size={18}
                        color={sendDisabled ? colors.textTertiary : colors.text}
                    />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

// Wrap with React.memo for performance
export const InputBar = React.memo(InputBarComponent);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    attachButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    attachButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusButton: {
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    mediaMenuItemInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ...
    inputFieldBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    input: {
        ...typography.body,
        color: colors.text,
        backgroundColor: colors.background, // Nested flat background
        borderRadius: radius.xl,
        paddingHorizontal: spacing.md,
        paddingTop: 12,
        paddingBottom: 12,
        maxHeight: 100,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        // Keep gradient for primary action to make it pop
    },
    mediaMenuContainer: {
        flexDirection: 'row',
        overflow: 'hidden',
        gap: spacing.xs,
    },
    mediaMenuItem: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },

    inputFieldWrapper: {
        flex: 1,
        position: 'relative',
    },



    sendButtonHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 20,
    },
});
