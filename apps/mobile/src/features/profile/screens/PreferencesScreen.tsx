import React from 'react';
import { ScrollView, StyleSheet, Platform } from 'react-native';

import { GradientBackground } from '../../../components/ui';
import { spacing } from '../../../theme';
import { useProfileSettings } from '../hooks';
import { ScreenHeader, PrivacySettings } from '../components';

/**
 * Preferences sub-screen for comfort zone and biometric settings.
 */
export function PreferencesScreen() {
    const settings = useProfileSettings();

    return (
        <GradientBackground>
            <ScreenHeader title="Preferences" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <PrivacySettings
                    maxIntensity={settings.maxIntensity}
                    isUpdatingIntensity={settings.isUpdatingIntensity}
                    onIntensityChange={settings.handleIntensityChange}
                    biometricAvailable={settings.biometricAvailable}
                    biometricEnabled={settings.biometricEnabled}
                    biometricType={settings.biometricType}
                    isUpdatingBiometric={settings.isUpdatingBiometric}
                    onBiometricToggle={settings.handleBiometricToggle}
                    partnerIntensity={settings.partnerIntensity}
                    partnerName={settings.partnerName}
                    partnerAvatar={settings.partnerAvatar}
                />
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
});

export default PreferencesScreen;
