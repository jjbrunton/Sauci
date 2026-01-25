import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Platform, KeyboardAvoidingView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../../components/ui';
import { colors, spacing, radius, typography } from '../../../theme';

interface ResetProgressProps {
    onResetProgress: () => Promise<void>;
}

export const ResetProgress: React.FC<ResetProgressProps> = ({ onResetProgress }) => {
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState("");
    const [isResetting, setIsResetting] = useState(false);

    const handleReset = async () => {
        if (resetConfirmText !== "RESET") return;
        setIsResetting(true);
        try {
            await onResetProgress();
            setShowResetModal(false);
            setResetConfirmText("");
        } catch (error) {
            // Error handling relies on parent
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <>
            <Animated.View
                entering={FadeInDown.delay(500).duration(500)}
                style={styles.section}
            >
                <Text style={styles.sectionTitle}>Reset Progress</Text>
                <GlassCard>
                    <View style={styles.content}>
                        <View style={styles.info}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="refresh" size={20} color={colors.warning} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={styles.title}>Start Fresh</Text>
                                <Text style={styles.description}>
                                    Delete all swipes, matches, and chats while keeping your partner connection.
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={() => setShowResetModal(true)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh-outline" size={16} color={colors.warning} />
                            <Text style={styles.resetButtonText}>Reset</Text>
                        </TouchableOpacity>
                    </View>
                </GlassCard>
            </Animated.View>

            <Modal
                visible={showResetModal}
                transparent
                animationType="fade"
                onRequestClose={() => !isResetting && setShowResetModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconContainer}>
                                <Ionicons name="refresh" size={32} color={colors.warning} />
                            </View>
                            <Text style={styles.modalTitle}>Reset Progress?</Text>
                        </View>

                        <Text style={styles.modalDescription}>
                            This action cannot be undone. This will permanently delete:
                        </Text>

                        <View style={styles.resetList}>
                            <View style={styles.resetListItem}>
                                <Ionicons name="swap-horizontal" size={16} color={colors.warning} />
                                <Text style={styles.resetListText}>All your swipes</Text>
                            </View>
                            <View style={styles.resetListItem}>
                                <Ionicons name="heart" size={16} color={colors.warning} />
                                <Text style={styles.resetListText}>All matches</Text>
                            </View>
                            <View style={styles.resetListItem}>
                                <Ionicons name="chatbubbles" size={16} color={colors.warning} />
                                <Text style={styles.resetListText}>All chat messages</Text>
                            </View>
                        </View>

                        <View style={styles.keepList}>
                            <View style={styles.keepListItem}>
                                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                                <Text style={styles.keepListText}>Your partner connection stays</Text>
                            </View>
                        </View>

                        <Text style={styles.confirmLabel}>
                            Type <Text style={styles.confirmKeyword}>RESET</Text> to confirm:
                        </Text>

                        <TextInput
                            style={styles.confirmInput}
                            value={resetConfirmText}
                            onChangeText={setResetConfirmText}
                            placeholder="Type RESET"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            editable={!isResetting}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowResetModal(false);
                                    setResetConfirmText("");
                                }}
                                disabled={isResetting}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.confirmResetButton,
                                    (resetConfirmText !== "RESET" || isResetting) && styles.confirmResetButtonDisabled,
                                ]}
                                onPress={handleReset}
                                disabled={resetConfirmText !== "RESET" || isResetting}
                                activeOpacity={0.7}
                            >
                                {isResetting ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <>
                                        <Ionicons name="refresh" size={16} color={colors.text} />
                                        <Text style={styles.confirmResetButtonText}>Reset</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    section: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 2,
        color: colors.textTertiary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    content: {
        gap: spacing.md,
    },
    info: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.warningLight,
        justifyContent: "center",
        alignItems: "center",
    },
    textContainer: {
        flex: 1,
        marginLeft: spacing.md,
    },
    title: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    description: {
        ...typography.subhead,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    resetButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.warningLight,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(243, 156, 18, 0.3)',
        gap: spacing.xs,
        alignSelf: "flex-end",
    },
    resetButtonText: {
        ...typography.subhead,
        color: colors.warning,
        fontWeight: "600",
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    modalContent: {
        width: "100%",
        maxWidth: 400,
        padding: spacing.xl,
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalHeader: {
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.warningLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    modalTitle: {
        ...typography.title2,
        color: colors.text,
        textAlign: "center",
    },
    modalDescription: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        textAlign: "center",
    },
    resetList: {
        backgroundColor: "rgba(243, 156, 18, 0.1)",
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(243, 156, 18, 0.2)',
    },
    resetListItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    resetListText: {
        ...typography.subhead,
        color: colors.text,
    },
    keepList: {
        backgroundColor: "rgba(46, 204, 113, 0.1)",
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(46, 204, 113, 0.2)',
    },
    keepListItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    keepListText: {
        ...typography.subhead,
        color: colors.text,
    },
    confirmLabel: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        textAlign: "center",
    },
    confirmKeyword: {
        fontWeight: "bold",
        color: colors.warning,
    },
    confirmInput: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.warning,
        padding: spacing.md,
        ...typography.body,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    modalButtons: {
        flexDirection: "row",
        gap: spacing.md,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: colors.background,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.textSecondary,
        fontWeight: "600",
    },
    confirmResetButton: {
        flex: 1,
        backgroundColor: colors.warning,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.xs,
    },
    confirmResetButtonDisabled: {
        opacity: 0.5,
    },
    confirmResetButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
    },
});
