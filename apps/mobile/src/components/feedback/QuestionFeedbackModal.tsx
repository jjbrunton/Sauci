import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { getDeviceInfo } from '../../lib/deviceInfo';
import { useAuthStore } from '../../store';
import { colors, gradients, spacing, radius, typography } from '../../theme';

interface QuestionFeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    questionId: string;
    questionText: string;
}

const FEEDBACK_REASONS = [
    { id: 'inappropriate', label: 'Inappropriate', icon: 'warning' as const },
    { id: 'confusing', label: 'Confusing', icon: 'help-circle' as const },
    { id: 'duplicate', label: 'Duplicate', icon: 'copy' as const },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' as const },
];

export function QuestionFeedbackModal({
    visible,
    onClose,
    questionId,
    questionText,
}: QuestionFeedbackModalProps) {
    const { user } = useAuthStore();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setSelectedReason(null);
        setAdditionalInfo('');
    };

    const handleClose = () => {
        if (!isSubmitting) {
            resetForm();
            onClose();
        }
    };

    const handleSubmit = async () => {
        if (!selectedReason) {
            Alert.alert('Please select a reason', 'Choose why you want to report this question.');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'You must be logged in to submit feedback.');
            return;
        }

        setIsSubmitting(true);

        try {
            const deviceInfo = getDeviceInfo();
            const reasonLabel = FEEDBACK_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;

            const { error } = await supabase.from('feedback').insert({
                user_id: user.id,
                type: 'question',
                title: `Question Feedback: ${reasonLabel}`,
                description: additionalInfo.trim() || `Reported as: ${reasonLabel}`,
                question_id: questionId,
                device_info: deviceInfo,
            });

            if (error) throw error;

            Alert.alert('Thank you!', 'Your feedback has been submitted.', [
                { text: 'OK', onPress: handleClose },
            ]);

            resetForm();
        } catch (error) {
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.headerIcon}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="flag" size={24} color={colors.text} />
                        </LinearGradient>
                        <Text style={styles.headerTitle}>Report Question</Text>
                    </View>

                    {/* Question Preview */}
                    <View style={styles.questionPreview}>
                        <Text style={styles.questionText} numberOfLines={2}>
                            "{questionText}"
                        </Text>
                    </View>

                    {/* Reason Selection */}
                    <Text style={styles.label}>What's the issue?</Text>
                    <View style={styles.reasonsGrid}>
                        {FEEDBACK_REASONS.map((reason) => (
                            <TouchableOpacity
                                key={reason.id}
                                style={[
                                    styles.reasonButton,
                                    selectedReason === reason.id && styles.reasonButtonActive,
                                ]}
                                onPress={() => setSelectedReason(reason.id)}
                                activeOpacity={0.7}
                                disabled={isSubmitting}
                            >
                                <Ionicons
                                    name={reason.icon}
                                    size={20}
                                    color={
                                        selectedReason === reason.id
                                            ? colors.text
                                            : colors.textSecondary
                                    }
                                />
                                <Text
                                    style={[
                                        styles.reasonText,
                                        selectedReason === reason.id && styles.reasonTextActive,
                                    ]}
                                >
                                    {reason.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Additional Info */}
                    <Text style={styles.label}>Additional details (optional)</Text>
                    <TextInput
                        style={styles.input}
                        value={additionalInfo}
                        onChangeText={setAdditionalInfo}
                        placeholder="Tell us more..."
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!isSubmitting}
                    />

                    {/* Buttons */}
                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleClose}
                            disabled={isSubmitting}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                !selectedReason && styles.submitButtonDisabled,
                            ]}
                            onPress={handleSubmit}
                            disabled={isSubmitting || !selectedReason}
                            activeOpacity={0.7}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color={colors.text} />
                            ) : (
                                <>
                                    <Ionicons name="send" size={16} color={colors.text} />
                                    <Text style={styles.submitButtonText}>Submit</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    content: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: colors.border,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    headerTitle: {
        ...typography.title3,
        color: colors.text,
        textAlign: 'center',
    },
    questionPreview: {
        backgroundColor: colors.background, // Flat inner container
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    questionText: {
        ...typography.subhead,
        color: colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    label: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    reasonsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    reasonButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.background, // Flat button
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    reasonButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    reasonText: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    reasonTextActive: {
        color: colors.text,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        ...typography.body,
        color: colors.text,
        minHeight: 80,
        marginBottom: spacing.md,
    },
    buttons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: colors.background,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        ...typography.body,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    submitButton: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: '600',
    },
});

export default QuestionFeedbackModal;
