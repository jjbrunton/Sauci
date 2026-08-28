import React from 'react';
import { ScrollView, StyleSheet, Platform } from 'react-native';

import { GradientBackground } from '../../../components/ui';
import { spacing } from '../../../theme';
import { useProfileSettings } from '../hooks';
import { ScreenHeader, PrivacySettings } from '../components';

/**
 * App-lock settings shared by iOS and Android.
 */
export function PreferencesScreen() {
    const settings = useProfileSettings();

    return (
        <GradientBackground>
            <ScreenHeader title="App Lock" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <PrivacySettings
                    biometricAvailable={settings.biometricAvailable}
                    biometricEnabled={settings.biometricEnabled}
                    biometricType={settings.biometricType}
                    isUpdatingBiometric={settings.isUpdatingBiometric}
                    onBiometricToggle={settings.handleBiometricToggle}
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
