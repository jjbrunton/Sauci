import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Platform, Linking } from 'react-native';

import { GradientBackground } from '../../../components/ui';
import { FeedbackModal } from '../../../components/feedback';
import { colors, spacing } from '../../../theme';
import { ScreenHeader, SettingsSection, MenuItem } from '../components';

/**
 * Help & Support sub-screen.
 */
export function SupportScreen() {
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    return (
        <GradientBackground>
            <ScreenHeader title="Help & Support" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <SettingsSection title="Support" delay={0}>
                    <MenuItem
                        icon="chatbubble-ellipses-outline"
                        label="Send Feedback"
                        description="Report bugs or request features"
                        onPress={() => setShowFeedbackModal(true)}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="shield-checkmark-outline"
                        label="Privacy Policy"
                        onPress={() => Linking.openURL('https://sauci.app/privacy')}
                    />
                    <View style={styles.divider} />
                    <MenuItem
                        icon="document-text-outline"
                        label="Terms of Service"
                        onPress={() => Linking.openURL('https://sauci.app/terms')}
                    />
                </SettingsSection>
            </ScrollView>

            <FeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
            />
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
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.md,
    },
});

export default SupportScreen;
