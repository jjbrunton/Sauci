import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * App icon badge management utility.
 * Sets the badge count on the app icon (iOS only, Android has no equivalent).
 */

/**
 * Set the app icon badge count.
 * On iOS, this updates the red badge number on the app icon.
 * On Android, this is a no-op as Android doesn't have app icon badges.
 */
export async function setBadgeCount(count: number): Promise<void> {
    // Badge count is iOS only
    if (Platform.OS !== 'ios') {
        return;
    }

    try {
        await Notifications.setBadgeCountAsync(Math.max(0, count));
    } catch (error) {
        console.error('Failed to set badge count:', error);
    }
}

/**
 * Clear the app icon badge.
 */
export async function clearBadge(): Promise<void> {
    await setBadgeCount(0);
}

/**
 * Get the current badge count.
 */
export async function getBadgeCount(): Promise<number> {
    if (Platform.OS !== 'ios') {
        return 0;
    }

    try {
        return await Notifications.getBadgeCountAsync();
    } catch (error) {
        console.error('Failed to get badge count:', error);
        return 0;
    }
}

/**
 * Sync badge count with the total of new matches and unread messages.
 * This should be called whenever either count changes.
 */
export async function syncBadgeCount(newMatchesCount: number, unreadMessagesCount: number): Promise<void> {
    const total = newMatchesCount + unreadMessagesCount;
    await setBadgeCount(total);
}
