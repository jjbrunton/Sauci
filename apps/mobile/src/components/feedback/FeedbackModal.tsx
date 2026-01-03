import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    Platform,
    Image,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { getDeviceInfo } from '../../lib/deviceInfo';
import { useAuthStore } from '../../store';
import { colors, gradients, spacing, radius, typography } from '../../theme';
import type { FeedbackType } from '../../types';

interface FeedbackModalProps {
    visible: boolean;
    onClose: () => void;
}

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { type: 'bug', label: 'Bug', icon: 'bug' },
    { type: 'feature_request', label: 'Feature', icon: 'bulb' },
    { type: 'general', label: 'General', icon: 'chatbubble-ellipses' },
];

export function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
    const { user } = useAuthStore();
    const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

    if (!visible) return null;

    const resetForm = () => {
        setFeedbackType('bug');
        setTitle('');
        setDescription('');
        setScreenshotUri(null);
        setErrors({});
    };

    const handleClose = () => {
        if (!isSubmitting) {
            resetForm();
            onClose();
        }
    };

    const handlePickScreenshot = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled) {
            setScreenshotUri(result.assets[0].uri);
        }
    };

    const uploadScreenshot = async (uri: string, userId: string): Promise<string> => {
        let fileBody;
        let ext = 'jpg';

        if (Platform.OS === 'web') {
            const response = await fetch(uri);
            const blob = await response.blob();
            fileBody = blob;

            if (blob.type === 'image/png') ext = 'png';
            else if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') ext = 'jpg';
            else if (blob.type === 'image/gif') ext = 'gif';
            else if (blob.type === 'image/webp') ext = 'webp';
        } else {
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            fileBody = decode(base64);
            ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
        }

        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const { error } = await supabase.storage
            .from('feedback-screenshots')
            .upload(fileName, fileBody, {
                contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                upsert: false,
            });

        if (error) throw error;

        // Get signed URL (private bucket)
        const { data } = await supabase.storage
            .from('feedback-screenshots')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

        return data?.signedUrl ?? '';
    };

    const handleSubmit = async () => {
        // Validate
        const newErrors: typeof errors = {};
        if (!title.trim()) newErrors.title = 'Title is required';
        if (!description.trim()) newErrors.description = 'Description is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        if (!user) {
            Alert.alert('Error', 'You must be logged in to submit feedback.');
            return;
        }

        setIsSubmitting(true);

        try {
            const deviceInfo = getDeviceInfo();
            let screenshotUrl: string | null = null;

            // Upload screenshot if provided
            if (screenshotUri) {
                screenshotUrl = await uploadScreenshot(screenshotUri, user.id);
            }

            // Insert feedback
            const { error } = await supabase.from('feedback').insert({
                user_id: user.id,
                type: feedbackType,
                title: title.trim(),
                description: description.trim(),
                screenshot_url: screenshotUrl,
                device_info: deviceInfo,
            });

            if (error) throw error;

            Alert.alert('Thank you!', 'Your feedback has been submitted successfully.', [
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

    const selectedOption = FEEDBACK_OPTIONS.find((o) => o.type === feedbackType)!;

    return (
        <View style={styles.fullScreen}>
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={handleClose}
            />
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.content}>
                    {/* Close Button */}
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleClose}
                        disabled={isSubmitting}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.headerIcon}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name={selectedOption.icon} size={28} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.headerTitle}>Send Feedback</Text>
                            <Text style={styles.headerSubtitle}>
                                Help us improve Sauci
                            </Text>
                        </View>

                        {/* Type Selector */}
                        <View style={styles.typeSelector}>
                            {FEEDBACK_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.type}
                                    style={[
                                        styles.typeButton,
                                        feedbackType === option.type && styles.typeButtonActive,
                                    ]}
                                    onPress={() => setFeedbackType(option.type)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={option.icon}
                                        size={18}
                                        color={
                                            feedbackType === option.type
                                                ? colors.text
                                                : colors.textSecondary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.typeButtonText,
                                            feedbackType === option.type && styles.typeButtonTextActive,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Title Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={[styles.input, errors.title && styles.inputError]}
                                value={title}
                                onChangeText={(text) => {
                                    setTitle(text);
                                    if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
                                }}
                                placeholder="Brief summary of your feedback"
                                placeholderTextColor={colors.textTertiary}
                                editable={!isSubmitting}
                            />
                            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
                        </View>

                        {/* Description Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    styles.textArea,
                                    errors.description && styles.inputError,
                                ]}
                                value={description}
                                onChangeText={(text) => {
                                    setDescription(text);
                                    if (errors.description)
                                        setErrors((e) => ({ ...e, description: undefined }));
                                }}
                                placeholder="Please provide details about the issue or suggestion..."
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                editable={!isSubmitting}
                            />
                            {errors.description && (
                                <Text style={styles.errorText}>{errors.description}</Text>
                            )}
                        </View>

                        {/* Screenshot Picker */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Screenshot (optional)</Text>
                            {screenshotUri ? (
                                <View style={styles.screenshotPreview}>
                                    <Image
                                        source={{ uri: screenshotUri }}
                                        style={styles.screenshotImage}
                                    />
                                    <TouchableOpacity
                                        style={styles.removeScreenshot}
                                        onPress={() => setScreenshotUri(null)}
                                        disabled={isSubmitting}
                                    >
                                        <Ionicons name="close-circle" size={24} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.screenshotPicker}
                                    onPress={handlePickScreenshot}
                                    disabled={isSubmitting}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name="image-outline"
                                        size={24}
                                        color={colors.textTertiary}
                                    />
                                    <Text style={styles.screenshotPickerText}>
                                        Tap to add a screenshot
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

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
                                style={styles.submitButton}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
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
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    fullScreen: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    content: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    closeButton: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        zIndex: 1,
        padding: spacing.xs,
    },
    scrollContent: {
        flexGrow: 1,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerTitle: {
        ...typography.title2,
        color: colors.text,
        textAlign: 'center',
    },
    headerSubtitle: {
        ...typography.subhead,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.glass.background,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    typeButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    typeButtonText: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    typeButtonTextActive: {
        color: colors.text,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    input: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.md,
        ...typography.body,
        color: colors.text,
    },
    inputError: {
        borderColor: colors.error,
    },
    textArea: {
        minHeight: 100,
        paddingTop: spacing.md,
    },
    errorText: {
        ...typography.caption1,
        color: colors.error,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
    screenshotPicker: {
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderStyle: 'dashed',
        padding: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    screenshotPickerText: {
        ...typography.subhead,
        color: colors.textTertiary,
    },
    screenshotPreview: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    screenshotImage: {
        width: 120,
        height: 120,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
    },
    removeScreenshot: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: colors.backgroundLight,
        borderRadius: 12,
    },
    buttons: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.lg,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: colors.glass.backgroundLight,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
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
    submitButtonText: {
        ...typography.body,
        color: colors.text,
        fontWeight: '600',
    },
});

export default FeedbackModal;
