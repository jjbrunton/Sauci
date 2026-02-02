import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    ScrollView,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeInUp,
    FadeOut,
    SlideInRight,
    SlideOutLeft,
} from 'react-native-reanimated';
import { GradientBackground } from '../../src/components/ui/GradientBackground';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { GlassButton } from '../../src/components/ui/GlassButton';
import { GlassToggle } from '../../src/components/ui/GlassToggle';
import { Paywall } from '../../src/components/paywall';
import { colors, gradients, spacing, typography, radius, shadows } from '../../src/theme';
import { useAuthStore } from '../../src/store';
import { supabase } from '../../src/lib/supabase';
import { getProfileError } from '../../src/lib/errors';
import { registerForPushNotificationsAsync, savePushToken } from '../../src/lib/notifications';
import { Events } from '../../src/lib/analytics';
import { hasSeenOnboardingPaywall, markOnboardingPaywallSeen } from '../../src/lib/onboardingPaywallSeen';
import { useAvatarPicker } from '../../src/hooks/useAvatarPicker';
import { REQUIRED_ONBOARDING_VERSION, ONBOARDING_OFFERING_ID } from '../../src/constants/onboarding';
import type { Gender } from '../../src/types';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
    { value: 'male', label: 'Male', icon: 'male' },
    { value: 'female', label: 'Female', icon: 'female' },
    { value: 'non-binary', label: 'Non-binary', icon: 'male-female' },
    { value: 'prefer-not-to-say', label: 'Skip', icon: 'remove-circle-outline' },
];

type UsageReason = 'improve_communication' | 'spice_up_intimacy' | 'deeper_connection' | 'have_fun' | 'strengthen_relationship';

const PURPOSE_OPTIONS: { value: UsageReason; label: string; icon: string }[] = [
    { value: 'improve_communication', label: 'Improve communication', icon: 'chatbubbles' },
    { value: 'spice_up_intimacy', label: 'Spice up intimacy', icon: 'flame' },
    { value: 'deeper_connection', label: 'Build deeper connection', icon: 'heart' },
    { value: 'have_fun', label: 'Have fun together', icon: 'happy' },
    { value: 'strengthen_relationship', label: 'Strengthen our relationship', icon: 'shield-checkmark' },
];

// Intensity thresholds for backwards compatibility
// When hide_nsfw=true, max_intensity=2 (mild content only)
// When hide_nsfw=false, max_intensity=5 (all content)
const NSFW_OFF_INTENSITY = 2;
const NSFW_ON_INTENSITY = 5;

type Stage = 'avatar' | 'name' | 'gender' | 'purpose' | 'content' | 'notifications';

export default function OnboardingScreen() {
    const router = useRouter();
    // Only subscribe to stable values to prevent re-renders from background fetchUser calls
    const userId = useAuthStore((s) => s.user?.id);
    const fetchUser = useAuthStore((s) => s.fetchUser);
    const initialUser = useRef(useAuthStore.getState().user);
    const [stage, setStage] = useState<Stage>('avatar');
    const [name, setName] = useState(initialUser.current?.name || '');
    const [gender, setGender] = useState<Gender | null>(initialUser.current?.gender || null);
    const [usageReason, setUsageReason] = useState<UsageReason | null>(null);
    const [hideNsfw, setHideNsfw] = useState(initialUser.current?.hide_nsfw ?? false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const paywallNavigationRef = useRef(false);

    const {
        avatarUri,
        isUploading: isUploadingAvatar,
        showPicker: handleAvatarPress,
        uploadAvatar,
    } = useAvatarPicker({
        userId,
        onSelect: () => setError(null),
    });

    useEffect(() => {
        Events.onboardingStart();
    }, []);

    const handleAvatarContinue = () => {
        if (!avatarUri) {
            setError('Please add a profile photo to continue');
            return;
        }
        setStage('name');
        Events.onboardingStageComplete('avatar');
    };

    const handleNameSubmit = () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        Keyboard.dismiss();
        setError(null);
        setStage('gender');
        Events.onboardingStageComplete('name');
    };

    const handleGenderSelect = (selectedGender: Gender) => {
        setGender(selectedGender);
        setError(null);
    };

    const handleGenderContinue = () => {
        if (!gender) {
            setError('Please select a gender or skip');
            return;
        }
        setStage('purpose');
        Events.onboardingStageComplete('gender');
    };

    const handlePurposeSelect = (selectedReason: UsageReason) => {
        setUsageReason(selectedReason);
        setError(null);
    };

    const handlePurposeContinue = () => {
        if (!usageReason) {
            setError('Please select what brings you to Sauci');
            return;
        }
        setStage('content');
        Events.onboardingStageComplete('purpose');
    };

    const handleContentContinue = () => {
        setStage('notifications');
        Events.onboardingStageComplete('content');
    };

    const handleEnableNotifications = async () => {
        setIsLoading(true);
        try {
            const token = await registerForPushNotificationsAsync();
            if (token && userId) {
                await savePushToken(userId, token);
            }
        } catch (err) {
            console.error('Failed to enable notifications:', err);
        } finally {
            setIsLoading(false);
            await handleComplete();
        }
    };

    const handleComplete = async () => {
        console.log('[Onboarding] handleComplete called, user:', userId, 'name:', name);
        if (!userId) {
            console.error('[Onboarding] No user ID available');
            setError('Not logged in. Please restart the app.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Upload avatar if one was selected
            let avatarUrl: string | null = null;
            if (avatarUri) {
                avatarUrl = await uploadAvatar();
                if (avatarUrl) {
                    Events.avatarUploaded();
                }
            }

            // Derive intensity from hide_nsfw for backwards compatibility
            const maxIntensity = hideNsfw ? NSFW_OFF_INTENSITY : NSFW_ON_INTENSITY;
            const showExplicitContent = !hideNsfw;
            const updatedFields: string[] = ["name", "gender", "usage_reason", "max_intensity", "show_explicit_content", "hide_nsfw"];

            const updateData: Record<string, any> = {
                name: name.trim(),
                gender,
                usage_reason: usageReason,
                max_intensity: maxIntensity,
                show_explicit_content: showExplicitContent,
                hide_nsfw: hideNsfw,
                onboarding_completed: true,
                onboarding_version: REQUIRED_ONBOARDING_VERSION,
                updated_at: new Date().toISOString(),
            };

            if (avatarUrl) {
                updateData.avatar_url = avatarUrl;
                updatedFields.push("avatar_url");
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', userId);

            if (updateError) {
                console.error('[Onboarding] Profile update error:', updateError);
                throw updateError;
            }

            console.log('[Onboarding] Profile updated successfully, fetching user...');
            await fetchUser();
            console.log('[Onboarding] User fetched, navigating to home...');
            Events.profileUpdated(updatedFields);
            Events.onboardingComplete();
            const currentUser = useAuthStore.getState().user;
            if (currentUser?.id && !currentUser.is_premium) {
                const hasSeenPaywall = await hasSeenOnboardingPaywall(currentUser.id);
                if (!hasSeenPaywall) {
                    paywallNavigationRef.current = true;
                    setShowPaywall(true);
                    return;
                }
            }
            router.replace('/');
        } catch (err: any) {
            console.error('Onboarding error:', err);
            setError(getProfileError(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handlePaywallClose = () => {
        setShowPaywall(false);
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.id) {
            void markOnboardingPaywallSeen(currentUser.id);
        }
        if (paywallNavigationRef.current) {
            paywallNavigationRef.current = false;
            router.replace('/');
        }
    };

    const renderStage = () => {
        switch (stage) {
            case 'avatar':
                return (
                    <Animated.View
                        key="avatar"
                        entering={FadeInUp.duration(500)}
                        exiting={SlideOutLeft.duration(300)}
                        style={styles.stageContainer}
                    >
                        <View style={styles.header}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.iconContainer}
                            >
                                <Ionicons name="heart" size={40} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.title}>Welcome to Sauci</Text>
                            <Text style={styles.subtitle}>
                                Add a profile photo so your partner knows it's you
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <View style={styles.avatarSection}>
                                <Pressable onPress={handleAvatarPress} style={styles.avatarTouchable}>
                                    {avatarUri ? (
                                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                                    ) : (
                                        <View
                                            style={styles.avatarPlaceholder}
                                        >
                                            <Ionicons name="camera" size={40} color={colors.textSecondary} />
                                        </View>
                                    )}
                                    <View style={styles.avatarBadge}>
                                        <Ionicons name={avatarUri ? "pencil" : "add"} size={16} color={colors.text} />
                                    </View>
                                </Pressable>
                                <Text style={styles.avatarHint}>
                                    {avatarUri ? 'Tap to change photo' : 'Tap to add a photo'}
                                </Text>
                            </View>
                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </GlassCard>

                        <View style={styles.footer}>
                            <GlassButton onPress={handleAvatarContinue} fullWidth size="lg">
                                Continue
                            </GlassButton>
                        </View>
                    </Animated.View>
                );

            case 'name':
                return (
                    <Animated.View
                        key="name"
                        entering={SlideInRight.duration(400)}
                        exiting={SlideOutLeft.duration(300)}
                        style={styles.stageContainer}
                    >
                        <View style={styles.header}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
                            ) : (
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.iconContainer}
                                >
                                    <Ionicons name="person" size={40} color={colors.text} />
                                </LinearGradient>
                            )}
                            <Text style={styles.title}>What can we call you?</Text>
                            <Text style={styles.subtitle}>
                                Nicknames and pet names are welcome too!
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <View style={styles.inputContainer}>
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={colors.textSecondary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    ref={inputRef}
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Your name or nickname"
                                    placeholderTextColor={colors.textTertiary}
                                    autoCapitalize="words"
                                    autoCorrect={false}
                                    autoFocus
                                    onSubmitEditing={handleNameSubmit}
                                    returnKeyType="next"
                                />
                            </View>
                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </GlassCard>

                        <View style={styles.footer}>
                            <GlassButton onPress={handleNameSubmit} fullWidth size="lg">
                                Continue
                            </GlassButton>
                        </View>
                    </Animated.View>
                );

            case 'gender':
                return (
                    <Animated.View
                        key="gender"
                        entering={SlideInRight.duration(400)}
                        exiting={SlideOutLeft.duration(300)}
                        style={styles.stageContainer}
                    >
                        <View style={styles.header}>
                            <Text style={styles.greeting}>Hey, {name.trim()}!</Text>
                            <Text style={styles.subtitle}>
                                This helps us show you the right questions
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <Text style={styles.label}>What's your gender?</Text>
                            <View style={styles.genderGrid}>
                                {GENDER_OPTIONS.map((option) => (
                                    <Pressable
                                        key={option.value}
                                        style={[
                                            styles.genderOption,
                                            gender === option.value && styles.genderOptionSelected,
                                        ]}
                                        onPress={() => handleGenderSelect(option.value)}
                                    >
                                        <Ionicons
                                            name={option.icon as any}
                                            size={28}
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
                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </GlassCard>

                        <View style={styles.footer}>
                            <GlassButton onPress={handleGenderContinue} fullWidth size="lg">
                                Continue
                            </GlassButton>
                        </View>
                    </Animated.View>
                );

            case 'purpose':
                return (
                    <Animated.View
                        key="purpose"
                        entering={SlideInRight.duration(400)}
                        exiting={SlideOutLeft.duration(300)}
                        style={styles.stageContainer}
                    >
                        <View style={styles.header}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.iconContainer}
                            >
                                <Ionicons name="sparkles" size={40} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.title}>What brings you here?</Text>
                            <Text style={styles.subtitle}>
                                This helps us personalize your experience
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <View style={styles.purposeList}>
                                {PURPOSE_OPTIONS.map((option) => (
                                    <Pressable
                                        key={option.value}
                                        style={[
                                            styles.purposeOption,
                                            usageReason === option.value && styles.purposeOptionSelected,
                                        ]}
                                        onPress={() => handlePurposeSelect(option.value)}
                                    >
                                        <View style={[
                                            styles.purposeIcon,
                                            usageReason === option.value && styles.purposeIconSelected
                                        ]}>
                                            <Ionicons
                                                name={option.icon as any}
                                                size={24}
                                                color={usageReason === option.value ? colors.primary : colors.textSecondary}
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.purposeLabel,
                                                usageReason === option.value && styles.purposeLabelSelected,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                        <View style={[
                                            styles.radioOuter,
                                            usageReason === option.value && styles.radioOuterSelected
                                        ]}>
                                            {usageReason === option.value && <View style={styles.radioInner} />}
                                        </View>
                                    </Pressable>
                                ))}
                            </View>
                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </GlassCard>

                        <View style={styles.footer}>
                            <GlassButton onPress={handlePurposeContinue} fullWidth size="lg">
                                Continue
                            </GlassButton>
                        </View>
                    </Animated.View>
                );

            case 'content':
                return (
                    <Animated.View
                        key="content"
                        entering={SlideInRight.duration(400)}
                        exiting={FadeOut.duration(200)}
                        style={styles.stageContainer}
                    >
                        <View style={styles.header}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.iconContainer}
                            >
                                <Ionicons name="flame" size={44} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.title}>Content Preferences</Text>
                            <Text style={styles.subtitle}>
                                Choose what type of content you'd like to see
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <View style={styles.contentToggleRow}>
                                <View style={styles.contentToggleLeft}>
                                    <LinearGradient
                                        colors={gradients.primary as [string, string]}
                                        style={styles.contentToggleIcon}
                                    >
                                        <Ionicons name="eye-off" size={24} color={colors.text} />
                                    </LinearGradient>
                                    <View style={styles.contentToggleText}>
                                        <Text style={styles.contentToggleLabel}>Hide Adult Content</Text>
                                        <Text style={styles.contentToggleDescription}>
                                            Only show mild, family-friendly question packs
                                        </Text>
                                    </View>
                                </View>
                                <GlassToggle
                                    value={hideNsfw}
                                    onValueChange={setHideNsfw}
                                />
                            </View>

                            <Text style={styles.contentNote}>
                                You can change this anytime in settings
                            </Text>

                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </GlassCard>

                        <View style={styles.footer}>
                            <GlassButton
                                onPress={handleContentContinue}
                                fullWidth
                                size="lg"
                            >
                                Continue
                            </GlassButton>
                        </View>
                    </Animated.View>
                );

            case 'notifications':
                return (
                    <Animated.View
                        key="notifications"
                        entering={SlideInRight.duration(400)}
                        exiting={FadeOut.duration(200)}
                        style={styles.stageContainer}
                    >
                        <View style={styles.header}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.iconContainer}
                            >
                                <Ionicons name="notifications" size={40} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.title}>Stay in the Loop</Text>
                            <Text style={styles.subtitle}>
                                Get notified when you and your partner match on answers
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <View style={styles.notificationFeature}>
                                <View style={styles.notificationIcon}>
                                    <Ionicons name="heart" size={24} color={colors.primary} />
                                </View>
                                <View style={styles.notificationText}>
                                    <Text style={styles.notificationTitle}>Match Alerts</Text>
                                    <Text style={styles.notificationDescription}>
                                        Know instantly when you both agree
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.notificationFeature, styles.notificationFeatureLast]}>
                                <View style={styles.notificationIcon}>
                                    <Ionicons name="chatbubble" size={24} color={colors.primary} />
                                </View>
                                <View style={styles.notificationText}>
                                    <Text style={styles.notificationTitle}>Messages</Text>
                                    <Text style={styles.notificationDescription}>
                                        Never miss a message from your partner
                                    </Text>
                                </View>
                            </View>
                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </GlassCard>

                        <View style={styles.footer}>
                            <GlassButton
                                onPress={handleEnableNotifications}
                                loading={isLoading}
                                fullWidth
                                size="lg"
                            >
                                Enable Notifications
                            </GlassButton>
                            <Pressable
                                style={styles.skipButton}
                                onPress={handleComplete}
                                disabled={isLoading}
                            >
                                <Text style={styles.skipText}>Maybe Later</Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                );
        }
    };

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Header with back button and progress dots */}
                <Animated.View entering={FadeIn.duration(600)} style={styles.headerBar}>
                    {stage !== 'avatar' ? (
                        <Pressable
                            style={styles.backButton}
                            onPress={() => {
                                setError(null);
                                if (stage === 'notifications') setStage('content');
                                else if (stage === 'content') setStage('purpose');
                                else if (stage === 'purpose') setStage('gender');
                                else if (stage === 'gender') setStage('name');
                                else if (stage === 'name') setStage('avatar');
                            }}
                        >
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
                        </Pressable>
                    ) : (
                        <View style={styles.backButtonPlaceholder} />
                    )}
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressDot, stage === 'avatar' && styles.progressDotActive]} />
                        <View style={[styles.progressDot, stage === 'name' && styles.progressDotActive]} />
                        <View style={[styles.progressDot, stage === 'gender' && styles.progressDotActive]} />
                        <View style={[styles.progressDot, stage === 'purpose' && styles.progressDotActive]} />
                        <View style={[styles.progressDot, stage === 'content' && styles.progressDotActive]} />
                        <View style={[styles.progressDot, stage === 'notifications' && styles.progressDotActive]} />
                    </View>
                    <View style={styles.backButtonPlaceholder} />
                </Animated.View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {renderStage()}
                </ScrollView>
            </KeyboardAvoidingView>

            <Paywall
                visible={showPaywall}
                onClose={handlePaywallClose}
                offeringId={ONBOARDING_OFFERING_ID}
            />
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.backgroundLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.border,
    },
    // ...
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
        backgroundColor: colors.backgroundLight,
    },
    // ...
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background, // Flat background
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    // ...
    genderOption: {
        width: '48%',
        alignItems: 'center',
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.border,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    // ...
    purposeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.border,
        padding: spacing.md,
    },
    // ...
    purposeIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ...
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ...
    notificationFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButtonPlaceholder: {
        width: 40,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
    },

    progressDotActive: {
        backgroundColor: colors.primary,
        width: 24,
    },
    stageContainer: {
        flex: 1,
        padding: spacing.lg,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
        ...shadows.lg,
    },
    headerAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: spacing.lg,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    avatarTouchable: {
        position: 'relative',
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: colors.primary,
    },

    avatarBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.background,
    },
    avatarHint: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    title: {
        ...typography.largeTitle,
        color: colors.text,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    greeting: {
        ...typography.largeTitle,
        color: colors.primary,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    card: {
        marginBottom: spacing.lg,
    },
    label: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.md,
    },

    inputIcon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        ...typography.body,
        color: colors.text,
        paddingVertical: spacing.md,
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
        ...typography.subhead,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    genderLabelSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    purposeList: {
        gap: spacing.sm,
    },

    purposeOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primaryLight,
    },

    purposeIconSelected: {
        backgroundColor: colors.primaryLight,
    },
    purposeLabel: {
        ...typography.subhead,
        color: colors.textSecondary,
        flex: 1,
    },
    purposeLabelSelected: {
        color: colors.text,
        fontWeight: '600',
    },
    contentToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    contentToggleLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    contentToggleIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    contentToggleText: {
        flex: 1,
    },
    contentToggleLabel: {
        ...typography.headline,
        color: colors.text,
    },
    contentToggleDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    contentNote: {
        ...typography.caption1,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.lg,
    },

    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    errorText: {
        ...typography.caption1,
        color: colors.error,
        flex: 1,
    },
    footer: {
        marginTop: 'auto',
    },

    notificationFeatureLast: {
        borderBottomWidth: 0,
    },
    notificationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    notificationText: {
        flex: 1,
    },
    notificationTitle: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    notificationDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: spacing.md,
        marginTop: spacing.sm,
    },
    skipText: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
});
