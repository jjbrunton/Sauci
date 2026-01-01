import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../../components/ui';
import { colors, spacing, radius, typography } from '../../../theme';

interface DangerZoneProps {
    onDeleteRelationship: () => Promise<void>;
}

export const DangerZone: React.FC<DangerZoneProps> = ({ onDeleteRelationship }) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (deleteConfirmText !== "DELETE") return;
        setIsDeleting(true);
        try {
            await onDeleteRelationship();
            setShowDeleteModal(false);
            setDeleteConfirmText("");
        } catch (error) {
            // Error handling relies on parent throwing or managing its own alerts
            // If parent throws, we stay on modal or close it?
            // Usually parent alerts.
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Animated.View
                entering={FadeInDown.delay(600).duration(500)}
                style={styles.section}
            >
                <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
                <GlassCard style={styles.dangerCard}>
                    <View style={styles.dangerContent}>
                        <View style={styles.dangerInfo}>
                            <View style={styles.dangerIconContainer}>
                                <Ionicons name="warning" size={20} color={colors.error} />
                            </View>
                            <View style={styles.dangerTextContainer}>
                                <Text style={styles.dangerTitle}>Delete All Data</Text>
                                <Text style={styles.dangerDescription}>
                                    Permanently delete your relationship including all matches, chats, and shared photos.
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={() => setShowDeleteModal(true)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                            <Text style={styles.dangerButtonText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </GlassCard>
            </Animated.View>

            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconContainer}>
                                <Ionicons name="warning" size={32} color={colors.error} />
                            </View>
                            <Text style={styles.modalTitle}>Delete All Data?</Text>
                        </View>

                        <Text style={styles.modalDescription}>
                            This action cannot be undone. This will permanently delete:
                        </Text>

                        <View style={styles.deleteList}>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="heart-dislike" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>Your couple connection</Text>
                            </View>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="checkmark-circle" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>All matches and responses</Text>
                            </View>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="chatbubbles" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>All chat messages</Text>
                            </View>
                            <View style={styles.deleteListItem}>
                                <Ionicons name="images" size={16} color={colors.error} />
                                <Text style={styles.deleteListText}>All shared photos</Text>
                            </View>
                        </View>

                        <Text style={styles.confirmLabel}>
                            Type <Text style={styles.confirmKeyword}>DELETE</Text> to confirm:
                        </Text>

                        <TextInput
                            style={styles.confirmInput}
                            value={deleteConfirmText}
                            onChangeText={setDeleteConfirmText}
                            placeholder="Type DELETE"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            editable={!isDeleting}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirmText("");
                                }}
                                disabled={isDeleting}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.confirmDeleteButton,
                                    deleteConfirmText !== "DELETE" && styles.confirmDeleteButtonDisabled,
                                ]}
                                onPress={handleDelete}
                                disabled={deleteConfirmText !== "DELETE" || isDeleting}
                                activeOpacity={0.7}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <>
                                        <Ionicons name="trash" size={16} color={colors.text} />
                                        <Text style={styles.confirmDeleteButtonText}>Delete</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    section: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    dangerSectionTitle: {
        ...typography.caption1,
        color: colors.error,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    dangerCard: {
        borderColor: 'rgba(231, 76, 60, 0.3)',
        borderWidth: 1,
    },
    dangerContent: {
        gap: spacing.md,
    },
    dangerInfo: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    dangerIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.errorLight,
        justifyContent: "center",
        alignItems: "center",
    },
    dangerTextContainer: {
        flex: 1,
        marginLeft: spacing.md,
    },
    dangerTitle: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    dangerDescription: {
        ...typography.subhead,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    dangerButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.errorLight,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.3)',
        gap: spacing.xs,
        alignSelf: "flex-end",
    },
    dangerButtonText: {
        ...typography.subhead,
        color: colors.error,
        fontWeight: "600",
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.xl,
        width: "100%",
        maxWidth: 400,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    modalHeader: {
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.errorLight,
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
    deleteList: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    deleteListItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    deleteListText: {
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
        color: colors.error,
    },
    confirmInput: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.error,
        marginBottom: spacing.xl,
        textAlign: "center",
    },
    modalButtons: {
        flexDirection: "row",
        gap: spacing.md,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
    },
    confirmDeleteButton: {
        flex: 1,
        flexDirection: "row",
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.error,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
    },
    confirmDeleteButtonDisabled: {
        opacity: 0.5,
        backgroundColor: colors.errorLight,
    },
    confirmDeleteButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
    },
});
