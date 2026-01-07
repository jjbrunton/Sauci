import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SettingsSection } from './SettingsSection';
import { SwitchItem } from './SwitchItem';
import { IntensitySlider } from '../../../components/ui/IntensitySlider';
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
    return (
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
                    <Text style={styles.comfortLabel}>Comfort Zone</Text>
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
});
