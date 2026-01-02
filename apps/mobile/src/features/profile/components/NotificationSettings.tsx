import React from 'react';

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
    return (
        <SettingsSection title="Notifications" delay={delay}>
            <SwitchItem
                icon="notifications-outline"
                label="Push Notifications"
                description="Get alerts for matches and messages"
                value={pushEnabled}
                onValueChange={onPushToggle}
                disabled={isUpdatingPush}
            />
        </SettingsSection>
    );
};
