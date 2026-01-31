import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../../../theme';
import { useNotificationPreferencesStore } from '../../../store';
import { useAuthStore } from '../../../store';
import { SettingsSection } from './SettingsSection';
import { SwitchItem } from './SwitchItem';

export interface NotificationSettingsProps {
    pushEnabled: boolean;
    isUpdatingPush: boolean;
    onPushToggle: (value: boolean) => void;
    delay?: number;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
    pushEnabled,
    isUpdatingPush,
    onPushToggle,
    delay = 360,
}) => {
    const { user } = useAuthStore();
    const { preferences, isUpdating, fetchPreferences, updatePreference } = useNotificationPreferencesStore();

    // Fetch notification preferences on mount when user is available
    useEffect(() => {
        if (user?.id && !preferences) {
            fetchPreferences();
        }
    }, [user?.id, preferences, fetchPreferences]);

    // Memoize handlers to prevent unnecessary re-renders
    const handlers = useMemo(() => ({
        onMatchesToggle: (value: boolean) => updatePreference('matches_enabled', value),
        onMessagesToggle: (value: boolean) => updatePreference('messages_enabled', value),
        onPartnerActivityToggle: (value: boolean) => updatePreference('partner_activity_enabled', value),
        onNudgesToggle: (value: boolean) => updatePreference('nudges_enabled', value),
        onPackChangesToggle: (value: boolean) => updatePreference('pack_changes_enabled', value),
        onNewPacksToggle: (value: boolean) => updatePreference('new_packs_enabled', value),
        onStreakMilestonesToggle: (value: boolean) => updatePreference('streak_milestones_enabled', value),
        onWeeklySummaryToggle: (value: boolean) => updatePreference('weekly_summary_enabled', value),
    }), [updatePreference]);

    return (
        <SettingsSection title="Notifications" delay={delay}>
            {/* Master push toggle */}
            <SwitchItem
                icon="notifications-outline"
                label="Push Notifications"
                description="Enable notifications on this device"
                value={pushEnabled}
                onValueChange={onPushToggle}
                disabled={isUpdatingPush}
            />

            {/* Granular settings - only show when push is enabled and preferences are loaded */}
            {pushEnabled && preferences && (
                <>
                    <View style={styles.sectionDivider}>
                        <Text style={styles.subsectionLabel}>Notification Types</Text>
                    </View>

                    <SwitchItem
                        icon="heart-outline"
                        label="Matches"
                        description="When you and your partner match"
                        value={preferences.matches_enabled}
                        onValueChange={handlers.onMatchesToggle}
                        disabled={isUpdating}
                    />

                    <View style={styles.itemDivider} />

                    <SwitchItem
                        icon="chatbubble-outline"
                        label="Messages"
                        description="When your partner sends you a message"
                        value={preferences.messages_enabled}
                        onValueChange={handlers.onMessagesToggle}
                        disabled={isUpdating}
                    />

                    <View style={styles.itemDivider} />

                    <SwitchItem
                        icon="person-outline"
                        label="Partner Activity"
                        description="When your partner answers questions"
                        value={preferences.partner_activity_enabled}
                        onValueChange={handlers.onPartnerActivityToggle}
                        disabled={isUpdating}
                    />

                    <View style={styles.itemDivider} />

                    <SwitchItem
                        icon="hand-left-outline"
                        label="Partner Nudges"
                        description="When your partner sends you a reminder"
                        value={preferences.nudges_enabled}
                        onValueChange={handlers.onNudgesToggle}
                        disabled={isUpdating}
                    />

                    <View style={styles.itemDivider} />

                    <SwitchItem
                        icon="layers-outline"
                        label="Pack Updates"
                        description="When your partner enables new packs"
                        value={preferences.pack_changes_enabled}
                        onValueChange={handlers.onPackChangesToggle}
                        disabled={isUpdating}
                    />

                    <View style={styles.itemDivider} />

                    <SwitchItem
                        icon="sparkles-outline"
                        label="New Packs"
                        description="When new question packs are available"
                        value={preferences.new_packs_enabled}
                        onValueChange={handlers.onNewPacksToggle}
                        disabled={isUpdating}
                    />

                    <View style={styles.itemDivider} />

                    <SwitchItem
                        icon="flame-outline"
                        label="Streak Milestones"
                        description="Celebrate your streak achievements"
                        value={preferences.streak_milestones_enabled}
                        onValueChange={handlers.onStreakMilestonesToggle}
                        disabled={isUpdating}
                    />

                    <View style={styles.itemDivider} />

                    <SwitchItem
                        icon="calendar-outline"
                        label="Weekly Recap"
                        description="Sunday summary of your weekly matches"
                        value={preferences.weekly_summary_enabled}
                        onValueChange={handlers.onWeeklySummaryToggle}
                        disabled={isUpdating}
                    />
                </>
            )}
        </SettingsSection>
    );
};

const styles = StyleSheet.create({
    sectionDivider: {
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    subsectionLabel: {
        ...typography.caption1,
        color: colors.textTertiary,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    itemDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.sm,
    },
});
