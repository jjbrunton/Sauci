import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeInUp,
    FadeOut,
    FadeOutLeft,
    SlideInRight,
    SlideOutLeft,
    Layout,
} from 'react-native-reanimated';
import { GradientBackground } from '../../src/components/ui/GradientBackground';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { GlassButton } from '../../src/components/ui/GlassButton';
import { colors, gradients, spacing, typography, radius, shadows } from '../../src/theme';
import { useAuthStore } from '../../src/store';
import { supabase } from '../../src/lib/supabase';
import type { Gender } from '../../src/types';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
    { value: 'male', label: 'Male', icon: 'male' },
    { value: 'female', label: 'Female', icon: 'female' },
    { value: 'non-binary', label: 'Non-binary', icon: 'male-female' },
    { value: 'prefer-not-to-say', label: 'Skip', icon: 'remove-circle-outline' },
];

type Stage = 'name' | 'gender' | 'explicit';

export default function OnboardingScreen() {
    const router = useRouter();
    const { user, fetchUser } = useAuthStore();
    const [stage, setStage] = useState<Stage>('name');
    const [name, setName] = useState(user?.name || '');
    const [gender, setGender] = useState<Gender | null>(user?.gender || null);
    const [showExplicit, setShowExplicit] = useState(user?.show_explicit_content || false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<TextInput>(null);

    const handleNameSubmit = () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        Keyboard.dismiss();
        setError(null);
        setStage('gender');
    };

    const handleGenderSelect = (selectedGender: Gender) => {
        setGender(selectedGender);
        setError(null);
        setTimeout(() => setStage('explicit'), 300);
    };

    const handleComplete = async () => {
        if (!user?.id) {
            setError('Not logged in. Please restart the app.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    name: name.trim(),
                    gender,
                    show_explicit_content: showExplicit,
                    onboarding_completed: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (updateError) {
                throw updateError;
            }

            await fetchUser();
            router.replace('/');
        } catch (err: any) {
            console.error('Onboarding error:', err);
            setError(err.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    const renderStage = () => {
        switch (stage) {
            case 'name':
                return (
                    <Animated.View
                        key="name"
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
                                Let's get to know you
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <Text style={styles.label}>What's your name?</Text>
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
                                    placeholder="Enter your name"
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
                        </GlassCard>
                    </Animated.View>
                );

            case 'explicit':
                return (
                    <Animated.View
                        key="explicit"
                        entering={SlideInRight.duration(400)}
                        exiting={FadeOut.duration(200)}
                        style={styles.stageContainer}
                    >
                        <View style={styles.header}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.iconContainer}
                            >
                                <Ionicons name="flame" size={40} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.title}>Almost there!</Text>
                            <Text style={styles.subtitle}>
                                Shall we keep it clean or show you everything?
                            </Text>
                        </View>

                        <GlassCard style={styles.card}>
                            <Pressable
                                style={styles.explicitOption}
                                onPress={() => setShowExplicit(true)}
                            >
                                <View style={[
                                    styles.explicitIcon,
                                    showExplicit && styles.explicitIconSelected
                                ]}>
                                    <Ionicons
                                        name="flame"
                                        size={32}
                                        color={showExplicit ? colors.primary : colors.textSecondary}
                                    />
                                </View>
                                <View style={styles.explicitText}>
                                    <Text style={[
                                        styles.explicitTitle,
                                        showExplicit && styles.explicitTitleSelected
                                    ]}>
                                        Show me everything
                                    </Text>
                                    <Text style={styles.explicitDescription}>
                                        Include 18+ question packs
                                    </Text>
                                </View>
                                <View style={[
                                    styles.radioOuter,
                                    showExplicit && styles.radioOuterSelected
                                ]}>
                                    {showExplicit && <View style={styles.radioInner} />}
                                </View>
                            </Pressable>

                            <Pressable
                                style={styles.explicitOption}
                                onPress={() => setShowExplicit(false)}
                            >
                                <View style={[
                                    styles.explicitIcon,
                                    !showExplicit && styles.explicitIconSelected
                                ]}>
                                    <Ionicons
                                        name="heart"
                                        size={32}
                                        color={!showExplicit ? colors.primary : colors.textSecondary}
                                    />
                                </View>
                                <View style={styles.explicitText}>
                                    <Text style={[
                                        styles.explicitTitle,
                                        !showExplicit && styles.explicitTitleSelected
                                    ]}>
                                        Keep it clean
                                    </Text>
                                    <Text style={styles.explicitDescription}>
                                        Only show SFW content
                                    </Text>
                                </View>
                                <View style={[
                                    styles.radioOuter,
                                    !showExplicit && styles.radioOuterSelected
                                ]}>
                                    {!showExplicit && <View style={styles.radioInner} />}
                                </View>
                            </Pressable>

                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </GlassCard>

                        <View style={styles.footer}>
                            <GlassButton
                                onPress={handleComplete}
                                loading={isLoading}
                                fullWidth
                                size="lg"
                            >
                                Let's Go!
                            </GlassButton>
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
            >
                {/* Header with back button and progress dots */}
                <Animated.View entering={FadeIn.duration(600)} style={styles.headerBar}>
                    {stage !== 'name' ? (
                        <Pressable
                            style={styles.backButton}
                            onPress={() => setStage(stage === 'explicit' ? 'gender' : 'name')}
                        >
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
                        </Pressable>
                    ) : (
                        <View style={styles.backButtonPlaceholder} />
                    )}
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressDot, stage === 'name' && styles.progressDotActive]} />
                        <View style={[styles.progressDot, stage === 'gender' && styles.progressDotActive]} />
                        <View style={[styles.progressDot, stage === 'explicit' && styles.progressDotActive]} />
                    </View>
                    <View style={styles.backButtonPlaceholder} />
                </Animated.View>

                {renderStage()}
            </KeyboardAvoidingView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButtonPlaceholder: {
        width: 40,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.glass.border,
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
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.background,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: spacing.md,
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
    genderOption: {
        width: '48%',
        alignItems: 'center',
        backgroundColor: colors.glass.background,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.glass.border,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
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
    explicitOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.background,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.glass.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    explicitIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.glass.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    explicitIconSelected: {
        backgroundColor: colors.primaryLight,
    },
    explicitText: {
        flex: 1,
    },
    explicitTitle: {
        ...typography.headline,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    explicitTitleSelected: {
        color: colors.text,
    },
    explicitDescription: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.glass.border,
        alignItems: 'center',
        justifyContent: 'center',
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
});
