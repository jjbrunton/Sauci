import React from 'react';
import { ScrollView, StyleSheet, Platform } from 'react-native';

import { GradientBackground } from '../../../components/ui';
import { spacing } from '../../../theme';
import { useProfileSettings } from '../hooks';
import { ScreenHeader, NotificationSettings } from '../components';

/**
 * Notifications settings sub-screen for push notification preferences.
 */
export function NotificationsScreen() {
    const settings = useProfileSettings();

    return (
        <GradientBackground>
            <ScreenHeader title="Notifications" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <NotificationSettings
                    pushEnabled={settings.pushEnabled}
                    isUpdatingPush={settings.isUpdatingPush}
                    onPushToggle={settings.handlePushToggle}
                    delay={0}
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

export default NotificationsScreen;
