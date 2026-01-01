import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SettingsSection } from './SettingsSection';
import { SwitchItem } from './SwitchItem';
import { colors, spacing } from '../../../theme';

interface PrivacySettingsProps {
    showExplicit: boolean;
    isUpdatingExplicit: boolean;
    onExplicitToggle: (value: boolean) => void;
    biometricAvailable: boolean;
    biometricEnabled: boolean;
    biometricType: string;
    isUpdatingBiometric: boolean;
    onBiometricToggle: (value: boolean) => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
    showExplicit,
    isUpdatingExplicit,
    onExplicitToggle,
    biometricAvailable,
    biometricEnabled,
    biometricType,
    isUpdatingBiometric,
    onBiometricToggle,
}) => {
    return (
        <SettingsSection title="Preferences" delay={375}>
            <SwitchItem
                icon="flame"
                label="Spicy Content"
                description="Show spicy question packs"
                value={showExplicit}
                onValueChange={onExplicitToggle}
                disabled={isUpdatingExplicit}
            />
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
        backgroundColor: colors.glass.border,
        marginVertical: spacing.md,
    },
});
