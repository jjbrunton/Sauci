import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "./supabase";
import { captureError } from "./sentry";

// Configure notification behavior for foreground
// We don't show system alerts since the app handles notifications with in-app toasts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Types
export interface NotificationData {
  type: "match" | "message";
  match_id?: string;
  message_id?: string;
}

/**
 * Request notification permissions and get Expo push token.
 * Returns null if permissions denied, on web, or if registration fails.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications don't work on web
  if (Platform.OS === "web") {
    return null;
  }

  try {
    // Check current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission denied");
      return null;
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("EAS project ID not configured - push notifications disabled");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    // This typically fails in simulator or development
    console.error("Failed to get push token:", error);
    captureError(error as Error, { context: "push_token_registration" });
    return null;
  }
}

/**
 * Save push token to user profile in Supabase.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ push_token: token })
    .eq("id", userId);

  if (error) {
    console.error("Failed to save push token:", error);
    captureError(new Error("Failed to save push token"), { userId, error: error.message });
  }
}

/**
 * Clear push token from user profile on sign out.
 */
export async function clearPushToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ push_token: null })
    .eq("id", userId);

  if (error) {
    console.error("Failed to clear push token:", error);
  }
}

/**
 * Handle notification tap - navigate to appropriate screen.
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as NotificationData;

  if (!data?.match_id) {
    return;
  }

  // Both match and message notifications navigate to chat
  router.push(`/(app)/chat/${data.match_id}`);
}

/**
 * Set up listener for notification taps (when app is running).
 * Returns subscription that should be cleaned up on unmount.
 */
export function setupNotificationResponseListener(): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
}

/**
 * Check if app was opened from a notification tap (cold start).
 */
export async function getInitialNotification(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}
