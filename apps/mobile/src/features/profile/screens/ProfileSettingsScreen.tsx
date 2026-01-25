import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Platform,
    TextInput,
    Pressable,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GradientBackground } from '../../../components/ui';
import { colors, featureColors, spacing, typography, radius } from '../../../theme';
import { useAuthStore } from '../../../store';
import { supabase } from '../../../lib/supabase';
import { Events } from '../../../lib/analytics';
import { useProfileSettings } from '../hooks';
import { ScreenHeader, SettingsSection } from '../components';
import type { Gender } from '../../../types';

// Hook to get email from auth session
function useAuthEmail() {
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        const getEmail = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setEmail(user?.email ?? null);
        };
        getEmail();
    }, []);

    return email;
}

const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
    { value: 'male', label: 'Male', icon: 'male' },
    { value: 'female', label: 'Female', icon: 'female' },
    { value: 'non-binary', label: 'Non-binary', icon: 'male-female' },
    { value: 'prefer-not-to-say', label: 'Prefer not to say', icon: 'remove-circle-outline' },
];

/**
 * Profile settings sub-screen for editing avatar, display name, and gender.
 */
export function ProfileSettingsScreen() {
    const { user, fetchUser, isAnonymous } = useAuthStore();
    const settings = useProfileSettings();
    const authEmail = useAuthEmail();

    // Local form state
    const [name, setName] = useState(user?.name || '');
    const [gender, setGender] = useState<Gender | null>(user?.gender || null);
    const [isSaving, setIsSaving] = useState(false);

    // Track if form has changes
    const hasChanges = name.trim() !== (user?.name || '') || gender !== (user?.gender || null);

    // Reset form when user changes
    useEffect(() => {
        setName(user?.name || '');
        setGender(user?.gender || null);
    }, [user?.name, user?.gender]);

    const handleSave = async () => {
        if (!user?.id) return;

        const trimmedName = name.trim();
        if (!trimmedName) {
            Alert.alert('Error', 'Name cannot be empty');
            return;
        }

        setIsSaving(true);

        try {
            const updates: Record<string, any> = {
                updated_at: new Date().toISOString(),
            };

            const changedFields: string[] = [];

            if (trimmedName !== user.name) {
                updates.name = trimmedName;
                changedFields.push('name');
            }

            if (gender !== user.gender) {
                updates.gender = gender;
                changedFields.push('gender');
            }

            if (changedFields.length === 0) {
                setIsSaving(false);
                return;
            }

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            await fetchUser();
            Events.profileUpdated(changedFields);
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error) {
            console.error('Failed to update profile:', error);
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <GradientBackground>
            <ScreenHeader
                title="Profile"
                rightElement={
                    hasChanges ? (
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={isSaving}
                            activeOpacity={0.7}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color={featureColors.profile.accent} />
                            ) : (
                                <Text style={styles.saveButton}>Save</Text>
                            )}
                        </TouchableOpacity>
                    ) : undefined
                }
            />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Avatar Section */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(500)}
                    style={styles.avatarSection}
                >
                    <TouchableOpacity
                        onPress={settings.handleAvatarPress}
                        disabled={settings.isUploadingAvatar}
                        activeOpacity={0.7}
                        style={styles.avatarTouchable}
                    >
                        <LinearGradient
                            colors={ACCENT_GRADIENT}
                            style={styles.avatarGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {user?.avatar_url ? (
                                <Image
                                    source={{ uri: user.avatar_url }}
                                    style={styles.avatarImage}
                                    cachePolicy="disk"
                                    transition={200}
                                />
                            ) : (
                                <View style={styles.avatarInner}>
                                    <Text style={styles.avatarText}>
                                        {user?.name?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                        {settings.isUploadingAvatar ? (
                            <View style={styles.avatarOverlay}>
                                <ActivityIndicator size="large" color={colors.text} />
                            </View>
                        ) : (
                            <View style={styles.avatarEditBadge}>
                                <Ionicons name="camera" size={16} color={colors.text} />
                            </View>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.avatarHint}>Tap to change photo</Text>
                </Animated.View>

                {/* Name Section */}
                <SettingsSection title="Display Name" delay={150}>
                    <View style={styles.inputContainer}>
                        <Ionicons
                            name="person-outline"
                            size={20}
                            color={colors.textSecondary}
                            style={styles.inputIcon}
                        />
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter your name"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="words"
                            autoCorrect={false}
                            returnKeyType="done"
                        />
                    </View>
                    <Text style={styles.inputHint}>
                        This is how your partner will see you
                    </Text>
                </SettingsSection>

                {/* Gender Section */}
                <SettingsSection title="Gender" delay={200}>
                    <Text style={styles.genderDescription}>
                        This helps us show you the right questions
                    </Text>
                    <View style={styles.genderGrid}>
                        {GENDER_OPTIONS.map((option) => (
                            <Pressable
                                key={option.value}
                                style={[
                                    styles.genderOption,
                                    gender === option.value && styles.genderOptionSelected,
                                ]}
                                onPress={() => setGender(option.value)}
                            >
                                <Ionicons
                                    name={option.icon as any}
                                    size={24}
                                    color={gender === option.value ? colors.primary : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.genderLabel,
                                        gender === option.value && styles.genderLabelSelected,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </SettingsSection>

                {/* Email (read-only) */}
                <SettingsSection title="Email" delay={250}>
                    <View style={styles.readOnlyField}>
                        <Ionicons
                            name="mail-outline"
                            size={20}
                            color={colors.textTertiary}
                            style={styles.inputIcon}
                        />
                        <Text style={styles.readOnlyText}>
                            {authEmail || (isAnonymous ? 'Guest account' : 'Loading...')}
                        </Text>
                    </View>
                    <Text style={styles.inputHint}>
                        {isAnonymous ? 'Save your account to add an email' : 'Email cannot be changed'}
                    </Text>
                </SettingsSection>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingTop: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    saveButton: {
        ...typography.headline,
        color: featureColors.profile.accent,
    },
    // Avatar
    avatarSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    avatarTouchable: {
        marginBottom: spacing.sm,
    },
    avatarGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
        // Removed shadows
    },
    // ...
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background, // Flat
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    // ...
    readOnlyField: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        opacity: 0.7,
    },
    // ...
    genderOption: {
        width: '48%',
        alignItems: 'center',
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        gap: spacing.xs,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        backgroundColor: colors.background,
    },
    avatarInner: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        ...typography.largeTitle,
        fontSize: 48,
        color: colors.text,
    },
    avatarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 60,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: colors.surfaceSolid,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.background,
    },
    avatarHint: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    // Input

    inputIcon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        ...typography.body,
        color: colors.text,
        paddingVertical: spacing.md,
    },
    inputHint: {
        ...typography.caption1,
        color: colors.textTertiary,
        marginTop: spacing.sm,
        marginLeft: spacing.xs,
    },
    // Read-only field

    readOnlyText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    // Gender
    genderDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    genderGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },

    genderOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primaryLight,
    },
    genderLabel: {
        ...typography.caption1,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    genderLabelSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    bottomSpacer: {
        height: spacing.xl,
    },
});

export default ProfileSettingsScreen;
