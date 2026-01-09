import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients } from '../../../theme';

interface FullScreenVideoModalProps {
    uri: string | null;
    visible: boolean;
    saving: boolean;
    onClose: () => void;
    onSave: () => void;
}

const FullScreenVideoModalComponent: React.FC<FullScreenVideoModalProps> = ({
    uri,
    visible,
    saving,
    onClose,
    onSave,
}) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    // Use safe area insets for button positioning to avoid notch/dynamic island
    const buttonTop = insets.top + 10;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={[styles.saveButton, { top: buttonTop }]}
                    onPress={onSave}
                    activeOpacity={0.8}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Save video to device"
                >
                    <LinearGradient
                        colors={gradients.premiumGold as [string, string]}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={colors.text} />
                        ) : (
                            <Ionicons name="download-outline" size={24} color={colors.text} />
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.closeButton, { top: buttonTop }]}
                    onPress={onClose}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Close full screen video"
                >
                    <LinearGradient
                        colors={gradients.premiumGold as [string, string]}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name="close" size={24} color={colors.text} />
                    </LinearGradient>
                </TouchableOpacity>

                {uri && (
                    <Video
                        source={{ uri }}
                        style={{ width: windowWidth, height: windowHeight * 0.8 }}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls
                        shouldPlay={visible}
                        isLooping={false}
                    />
                )}
            </View>
        </Modal>
    );
};

export const FullScreenVideoModal = React.memo(FullScreenVideoModalComponent);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
    },
    saveButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
    },
    buttonGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
