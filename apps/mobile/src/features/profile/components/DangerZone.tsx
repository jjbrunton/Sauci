import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Platform, KeyboardAvoidingView, TouchableOpacity, ActivityIndicator, TextInput, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GlassCard, GlassButton } from '../../../components/ui';
import { colors, spacing, radius, typography } from '../../../theme';

interface DangerZoneProps {
    onDeleteRelationship?: () => Promise<void>;
    onDeleteAccount: () => Promise<void>;
    hasRelationship?: boolean;
}

export const DangerZone: React.FC<DangerZoneProps> = ({
    onDeleteRelationship,
    onDeleteAccount,
    hasRelationship = false
}) => {
    const [showDeleteRelationshipModal, setShowDeleteRelationshipModal] = useState(false);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [isDeletingRelationship, setIsDeletingRelationship] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const handleDeleteRelationship = async () => {
        if (deleteConfirmText !== "DELETE" || !onDeleteRelationship) return;
        setIsDeletingRelationship(true);
        try {
            await onDeleteRelationship();
            setShowDeleteRelationshipModal(false);
            setDeleteConfirmText("");
        } catch (error) {
            // Error handling relies on parent throwing or managing its own alerts
        } finally {
            setIsDeletingRelationship(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== "DELETE") return;
        setIsDeletingAccount(true);
        try {
            await onDeleteAccount();
            // No need to close modal - user will be signed out
        } catch (error) {
            // Error handling relies on parent throwing or managing its own alerts
            setIsDeletingAccount(false);
        }
    };

    const closeRelationshipModal = () => {
        if (!isDeletingRelationship) {
            setShowDeleteRelationshipModal(false);
            setDeleteConfirmText("");
        }
    };

    const closeAccountModal = () => {
        if (!isDeletingAccount) {
            setShowDeleteAccountModal(false);
            setDeleteConfirmText("");
        }
    };

    return (
        <>
            <Animated.View
                entering={FadeInDown.delay(600).duration(500)}
                style={styles.section}
            >
                <Text style={styles.dangerSectionTitle}>Danger Zone</Text>

                {/* Delete Relationship - only show if in a relationship */}
                {hasRelationship && onDeleteRelationship && (
                    <GlassCard style={styles.dangerCard}>
                        <View style={styles.dangerContent}>
                            <View style={styles.dangerInfo}>
                                <View style={styles.dangerIconContainer}>
                                    <Ionicons name="heart-dislike" size={20} color={colors.error} />
                                </View>
                                <View style={styles.dangerTextContainer}>
                                    <Text style={styles.dangerTitle}>Delete Relationship Data</Text>
                                    <Text style={styles.dangerDescription}>
                                        Delete your relationship including all matches, chats, and shared photos. Your account will remain.
                                    </Text>
                                </View>
                            </View>
                            <GlassButton
                                variant="danger"
                                size="sm"
                                onPress={() => setShowDeleteRelationshipModal(true)}
                                icon={<Ionicons name="trash-outline" size={16} color={colors.text} />}
                                style={styles.dangerButton}
                            >
                                Delete
                            </GlassButton>
                        </View>
                    </GlassCard>
                )}

                {/* Delete Account - always show */}
                <GlassCard style={hasRelationship ? StyleSheet.flatten([styles.dangerCard, styles.dangerCardSpacing]) as ViewStyle : styles.dangerCard}>
                    <View style={styles.dangerContent}>
                        <View style={styles.dangerInfo}>
                            <View style={styles.dangerIconContainer}>
                                <Ionicons name="person-remove" size={20} color={colors.error} />
                            </View>
                            <View style={styles.dangerTextContainer}>
                                <Text style={styles.dangerTitle}>Delete Account</Text>
                                <Text style={styles.dangerDescription}>
                                    Permanently delete your account and all associated data. This cannot be undone.
                                </Text>
                            </View>
                        </View>
                        <GlassButton
                            variant="danger"
                            size="sm"
                            onPress={() => setShowDeleteAccountModal(true)}
                            icon={<Ionicons name="trash-outline" size={16} color={colors.text} />}
                            style={styles.dangerButton}
                        >
                            Delete
                        </GlassButton>
                    </View>
                </GlassCard>
            </Animated.View>

            {/* Delete Relationship Modal */}
            <Modal
                visible={showDeleteRelationshipModal}
                transparent
                animationType="fade"
                onRequestClose={closeRelationshipModal}
            >
                <BlurView
                    intensity={Platform.OS === 'ios' ? 20 : 0}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalOverlay}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View style={styles.modalIconContainer}>
                                    <Ionicons name="heart-dislike" size={32} color={colors.error} />
                                </View>
                                <Text style={styles.modalTitle}>Delete Relationship Data?</Text>
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
                                editable={!isDeletingRelationship}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={closeRelationshipModal}
                                    disabled={isDeletingRelationship}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.deleteButton,
                                        (deleteConfirmText !== "DELETE" || isDeletingRelationship) && styles.deleteButtonDisabled,
                                    ]}
                                    onPress={handleDeleteRelationship}
                                    disabled={deleteConfirmText !== "DELETE" || isDeletingRelationship}
                                    activeOpacity={0.7}
                                >
                                    {isDeletingRelationship ? (
                                        <ActivityIndicator size="small" color={colors.text} />
                                    ) : (
                                        <>
                                            <Ionicons name="trash" size={16} color={colors.text} />
                                            <Text style={styles.deleteButtonText}>Delete</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </BlurView>
            </Modal>

            {/* Delete Account Modal */}
            <Modal
                visible={showDeleteAccountModal}
                transparent
                animationType="fade"
                onRequestClose={closeAccountModal}
            >
                <BlurView
                    intensity={Platform.OS === 'ios' ? 20 : 0}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalOverlay}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View style={styles.modalIconContainer}>
                                    <Ionicons name="person-remove" size={32} color={colors.error} />
                                </View>
                                <Text style={styles.modalTitle}>Delete Account?</Text>
                            </View>

                            <Text style={styles.modalDescription}>
                                This action cannot be undone. This will permanently delete:
                            </Text>

                            <View style={styles.deleteList}>
                                <View style={styles.deleteListItem}>
                                    <Ionicons name="person" size={16} color={colors.error} />
                                    <Text style={styles.deleteListText}>Your account and profile</Text>
                                </View>
                                {hasRelationship && (
                                    <>
                                        <View style={styles.deleteListItem}>
                                            <Ionicons name="heart-dislike" size={16} color={colors.error} />
                                            <Text style={styles.deleteListText}>Your relationship data</Text>
                                        </View>
                                        <View style={styles.deleteListItem}>
                                            <Ionicons name="chatbubbles" size={16} color={colors.error} />
                                            <Text style={styles.deleteListText}>All chat messages and photos</Text>
                                        </View>
                                    </>
                                )}
                                <View style={styles.deleteListItem}>
                                    <Ionicons name="key" size={16} color={colors.error} />
                                    <Text style={styles.deleteListText}>Your encryption keys</Text>
                                </View>
                                <View style={styles.deleteListItem}>
                                    <Ionicons name="cloud-offline" size={16} color={colors.error} />
                                    <Text style={styles.deleteListText}>All cloud-stored data</Text>
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
                                editable={!isDeletingAccount}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={closeAccountModal}
                                    disabled={isDeletingAccount}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.deleteButton,
                                        (deleteConfirmText !== "DELETE" || isDeletingAccount) && styles.deleteButtonDisabled,
                                    ]}
                                    onPress={handleDeleteAccount}
                                    disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                                    activeOpacity={0.7}
                                >
                                    {isDeletingAccount ? (
                                        <ActivityIndicator size="small" color={colors.text} />
                                    ) : (
                                        <>
                                            <Ionicons name="trash" size={16} color={colors.text} />
                                            <Text style={styles.deleteButtonText}>Delete Account</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </BlurView>
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
    dangerCardSpacing: {
        marginTop: spacing.md,
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
        alignSelf: "flex-end",
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
        backgroundColor: "rgba(231, 76, 60, 0.1)",
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.2)',
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
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.error,
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
        backgroundColor: colors.glass.backgroundLight,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.textSecondary,
        fontWeight: "600",
    },
    deleteButton: {
        flex: 1,
        backgroundColor: colors.error,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.xs,
    },
    deleteButtonDisabled: {
        opacity: 0.5,
    },
    deleteButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: "600",
    },
});
