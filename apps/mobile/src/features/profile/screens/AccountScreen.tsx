import React from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { GradientBackground } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { useAuthStore } from '../../../store';
import { useCoupleManagement } from '../hooks';
import { ScreenHeader, SettingsSection, MenuItem, DangerZone } from '../components';

/**
 * Account settings sub-screen (sign out, delete account).
 */
export function AccountScreen() {
    const router = useRouter();
    const { couple, isAnonymous } = useAuthStore();
    const { handleSignOut, handleDeleteAccount } = useCoupleManagement();

    return (
        <GradientBackground>
            <ScreenHeader title="Account" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <SettingsSection title="Account" delay={0}>
                    {isAnonymous ? (
                        <MenuItem
                            icon="shield-checkmark-outline"
                            label="Save Account"
                            description="Protect access across devices"
                            onPress={() => router.push("/(app)/settings/save-account" as any)}
                            showChevron={false}
                        />
                    ) : (
                        <MenuItem
                            icon="log-out-outline"
                            label="Sign Out"
                            onPress={handleSignOut}
                            variant="danger"
                            showChevron={false}
                        />
                    )}
                </SettingsSection>

                <View style={styles.spacer} />

                {/* Account Danger Zone - delete account only */}
                <DangerZone
                    onDeleteAccount={handleDeleteAccount}
                    hasRelationship={!!couple}
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
    spacer: {
        height: spacing.md,
    },
});

export default AccountScreen;
