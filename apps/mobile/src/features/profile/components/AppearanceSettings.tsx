import React from 'react';

import { ProfileHeader } from './ProfileHeader';
import type { ProfileHeaderProps } from './ProfileHeader';

export type AppearanceSettingsProps = ProfileHeaderProps;

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = (props) => {
    return <ProfileHeader {...props} />;
};
