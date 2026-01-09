import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients } from '../../../theme';

const ACCENT = colors.premium.gold;

interface FullScreenImageModalProps {
    uri: string | null;
    visible: boolean;
    loading: boolean;
    saving: boolean;
    onClose: () => void;
    onSave: () => void;
    onLoadStart: () => void;
    onLoadEnd: () => void;
}

const FullScreenImageModalComponent: React.FC<FullScreenImageModalProps> = ({
    uri,
    visible,
    loading,
    saving,
    onClose,
    onSave,
    onLoadStart,
    onLoadEnd,
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
                    accessibilityLabel="Save image to device"
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
                    accessibilityLabel="Close full screen image"
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

                {loading && (
                    <ActivityIndicator size="large" color={ACCENT} style={styles.spinner} />
                )}

                {uri && (
                    <Image
                        source={{ uri }}
                        style={{ width: windowWidth, height: windowHeight * 0.8 }}
                        contentFit="contain"
                        cachePolicy="disk"
                        onLoadStart={onLoadStart}
                        onLoadEnd={onLoadEnd}
                    />
                )}
            </View>
        </Modal>
    );
};

export const FullScreenImageModal = React.memo(FullScreenImageModalComponent);

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
    spinner: {
        position: 'absolute',
    },
});
