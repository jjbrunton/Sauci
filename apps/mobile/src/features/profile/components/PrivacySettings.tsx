import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { SettingsSection } from './SettingsSection';
import { SwitchItem } from './SwitchItem';
import { colors, spacing } from '../../../theme';

interface PrivacySettingsProps {
    biometricAvailable: boolean;
    biometricEnabled: boolean;
    biometricType: string;
    isUpdatingBiometric: boolean;
    onBiometricToggle: (value: boolean) => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
    biometricAvailable,
    biometricEnabled,
    biometricType,
    isUpdatingBiometric,
    onBiometricToggle,
}) => {
    return (
        <SettingsSection title="Security" delay={375}>
            {biometricAvailable && (
                <SwitchItem
                    icon={biometricType === "Face ID" || biometricType === "Face Recognition" ? "scan-outline" : "finger-print-outline"}
                    label={biometricType}
                    description="Require unlock when opening app"
                    value={biometricEnabled}
                    onValueChange={onBiometricToggle}
                    disabled={isUpdatingBiometric}
                />
            )}
            {!biometricAvailable && (
                <View style={styles.unavailableRow}>
                    <Text style={styles.unavailableText}>
                        Biometric app lock is not available on this device.
                    </Text>
                </View>
            )}
        </SettingsSection>
    );
};

const styles = StyleSheet.create({
    unavailableRow: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    unavailableText: {
        color: colors.textSecondary,
        lineHeight: 20,
    },
});
