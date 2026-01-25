import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SettingsSection } from './SettingsSection';
import { SwitchItem } from './SwitchItem';
import { colors, spacing } from '../../../theme';

interface PrivacySettingsProps {
    biometricAvailable: boolean;
    biometricEnabled: boolean;
    biometricType: string;
    isUpdatingBiometric: boolean;
    onBiometricToggle: (value: boolean) => void;
    hideNsfw: boolean;
    isUpdatingHideNsfw: boolean;
    onHideNsfwToggle: (value: boolean) => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
    biometricAvailable,
    biometricEnabled,
    biometricType,
    isUpdatingBiometric,
    onBiometricToggle,
    hideNsfw,
    isUpdatingHideNsfw,
    onHideNsfwToggle,
}) => {
    return (
        <SettingsSection title="Preferences" delay={375}>
            {/* Hide Adult Content Toggle */}
            <SwitchItem
                icon="eye-off-outline"
                label="Hide Adult Content"
                description="Only show mild, family-friendly question packs"
                value={hideNsfw}
                onValueChange={onHideNsfwToggle}
                disabled={isUpdatingHideNsfw}
            />

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
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.lg,
    },
});
