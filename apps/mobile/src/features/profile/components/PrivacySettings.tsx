import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { SettingsSection } from './SettingsSection';
import { SwitchItem } from './SwitchItem';
import { IntensitySlider } from '../../../components/ui/IntensitySlider';
import { GlassButton } from '../../../components/ui';
import { colors, spacing, radius, typography, featureColors } from '../../../theme';
import type { IntensityLevel } from '../../../types';

interface PrivacySettingsProps {
    maxIntensity: IntensityLevel;
    isUpdatingIntensity: boolean;
    onIntensityChange: (value: IntensityLevel) => void;
    biometricAvailable: boolean;
    biometricEnabled: boolean;
    biometricType: string;
    isUpdatingBiometric: boolean;
    onBiometricToggle: (value: boolean) => void;
    // Partner info for slider comparison
    partnerIntensity?: IntensityLevel | null;
    partnerName?: string;
    partnerAvatar?: string | null;
}

const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
    maxIntensity,
    isUpdatingIntensity,
    onIntensityChange,
    biometricAvailable,
    biometricEnabled,
    biometricType,
    isUpdatingBiometric,
    onBiometricToggle,
    partnerIntensity,
    partnerName,
    partnerAvatar,
}) => {
    const [showHelpModal, setShowHelpModal] = useState(false);

    return (
        <>
        <SettingsSection title="Preferences" delay={375}>
            {/* Comfort Zone Header */}
            <View style={styles.comfortHeader}>
                <LinearGradient
                    colors={ACCENT_GRADIENT}
                    style={styles.comfortIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="heart-circle" size={22} color={colors.text} />
                </LinearGradient>
                <View style={styles.comfortText}>
                    <View style={styles.comfortLabelRow}>
                        <Text style={styles.comfortLabel}>Comfort Zone</Text>
                        <TouchableOpacity
                            onPress={() => setShowHelpModal(true)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.comfortDescription}>
                        Set the intimacy level you're comfortable with
                    </Text>
                </View>
            </View>

            {/* Intensity Slider */}
            <View style={styles.sliderContainer}>
                <IntensitySlider
                    value={maxIntensity}
                    onValueChange={onIntensityChange}
                    disabled={isUpdatingIntensity}
                    partnerValue={partnerIntensity}
                    partnerName={partnerName}
                    partnerAvatar={partnerAvatar}
                />
            </View>

            {/* Biometric Toggle */}
            {biometricAvailable && (
                <>
                    <View style={styles.divider} />
                    <SwitchItem
                        icon={biometricType === "Face ID" || biometricType === "Face Recognition" ? "scan-outline" : "finger-print-outline"}
                        label={biometricType}
                        description="Require unlock when opening app"
                        value={biometricEnabled}
                        onValueChange={onBiometricToggle}
                        disabled={isUpdatingBiometric}
                    />
                </>
            )}
        </SettingsSection>

        {/* Help Modal */}
        <Modal
            visible={showHelpModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowHelpModal(false)}
        >
            <BlurView
                intensity={Platform.OS === 'ios' ? 20 : 0}
                tint="dark"
                style={StyleSheet.absoluteFill}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>How Comfort Zone Works</Text>
                            <TouchableOpacity
                                onPress={() => setShowHelpModal(false)}
                                style={styles.closeButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.helpScrollView}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.helpSection}>
                                <View style={styles.helpItem}>
                                    <Ionicons name="layers-outline" size={20} color={colors.primary} style={styles.helpIcon} />
                                    <View style={styles.helpTextContainer}>
                                        <Text style={styles.helpItemTitle}>Intensity Levels</Text>
                                        <Text style={styles.helpItemDescription}>
                                            Questions range from 1 (mild) to 5 (spicy). You'll only see questions at or below your comfort level.
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.helpItem}>
                                    <Ionicons name="albums-outline" size={20} color={colors.primary} style={styles.helpIcon} />
                                    <View style={styles.helpTextContainer}>
                                        <Text style={styles.helpItemTitle}>Hidden Packs</Text>
                                        <Text style={styles.helpItemDescription}>
                                            Some question packs are designed for higher intensity levels. These packs won't appear until you raise your comfort zone.
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.helpItem}>
                                    <Ionicons name="people-outline" size={20} color={colors.primary} style={styles.helpIcon} />
                                    <View style={styles.helpTextContainer}>
                                        <Text style={styles.helpItemTitle}>Partner Sync</Text>
                                        <Text style={styles.helpItemDescription}>
                                            Questions only appear when both of you are comfortable. The lower setting between you and your partner determines what you both see.
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.helpItem}>
                                    <Ionicons name="eye-outline" size={20} color={colors.primary} style={styles.helpIcon} />
                                    <View style={styles.helpTextContainer}>
                                        <Text style={styles.helpItemTitle}>Visible to Partner</Text>
                                        <Text style={styles.helpItemDescription}>
                                            Your partner can see the comfort zone level you choose so you can stay aligned. This doesn’t reveal your individual swipes.
                                        </Text>
                                    </View>
                                </View>

                                <View style={[styles.helpItem, styles.helpItemLast]}>
                                    <Ionicons name="refresh-outline" size={20} color={colors.primary} style={styles.helpIcon} />
                                    <View style={styles.helpTextContainer}>
                                        <Text style={styles.helpItemTitle}>Change Anytime</Text>
                                        <Text style={styles.helpItemDescription}>
                                            Adjust whenever you want. New questions and packs will appear or hide based on your new setting.
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>

                        <GlassButton
                            onPress={() => setShowHelpModal(false)}
                            fullWidth
                        >
                            Got it
                        </GlassButton>
                    </View>
                </View>
            </BlurView>
        </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    comfortHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    comfortIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    comfortText: {
        flex: 1,
    },
    comfortLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    comfortLabel: {
        ...typography.headline,
        color: colors.text,
    },
    comfortDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    sliderContainer: {
        marginBottom: spacing.sm,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginVertical: spacing.lg,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    modalTitle: {
        ...typography.headline,
        color: colors.text,
    },
    closeButton: {
        padding: spacing.xs,
    },
    helpScrollView: {
        flexGrow: 0,
        marginBottom: spacing.md,
    },
    helpSection: {
        gap: spacing.sm,
    },
    helpItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing.sm,
    },
    helpItemLast: {
        paddingBottom: 0,
    },
    helpIcon: {
        marginRight: spacing.sm,
        marginTop: 2,
    },
    helpTextContainer: {
        flex: 1,
    },
    helpItemTitle: {
        ...typography.subhead,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    helpItemDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
        lineHeight: 18,
    },
});
