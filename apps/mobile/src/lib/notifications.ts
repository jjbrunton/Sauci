import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "./supabase";
import { captureError } from "./sentry";
import { Events } from "./analytics";

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
      // Track permission result (only when we actually requested)
      if (status === "granted") {
        Events.notificationPermissionGranted();
      } else {
        Events.notificationPermissionDenied();
      }
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
 * Get Expo push token with retry logic for Android.
 * On Android, Firebase may not be initialized immediately on app start,
 * so we retry a few times with increasing delays.
 */
async function getExpoPushTokenWithRetry(
  projectId: string,
  maxRetries = 5
): Promise<string | null> {
  console.log(`[Push] Getting token for project: ${projectId}, platform: ${Platform.OS}`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Push] Attempt ${attempt + 1}/${maxRetries} to get push token...`);
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      console.log(`[Push] Successfully got token: ${tokenData.data}`);
      return tokenData.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Push] Attempt ${attempt + 1} failed: ${errorMessage}`);

      // Retry for any Firebase-related errors on Android
      const isFirebaseError =
        error instanceof Error &&
        (error.message.includes("Firebase") ||
         error.message.includes("FCM") ||
         error.message.includes("Google Play"));

      if (Platform.OS === "android" && attempt < maxRetries - 1) {
        const delay = (attempt + 1) * 1000;
        console.log(`[Push] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
  return null;
}

/**
 * Check if current device needs to register for push notifications.
 * This handles the case where a user onboarded on one device (e.g., iOS)
 * and then installs on another device (e.g., Android) - the new device
 * needs its own push token.
 *
 * Returns true if a new token was registered.
 */
export async function checkAndRegisterPushToken(userId: string): Promise<boolean> {
  console.log(`[Push] checkAndRegisterPushToken called for user: ${userId}`);

  if (Platform.OS === "web") {
    console.log("[Push] Skipping - web platform");
    return false;
  }

  try {
    // First check if permissions are already granted
    const { status } = await Notifications.getPermissionsAsync();
    console.log(`[Push] Current permission status: ${status}`);

    // If permissions not granted, we need to prompt the user
    // But only do this if we don't already have a token for this device
    if (status !== "granted") {
      console.log("[Push] Requesting permissions...");
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      console.log(`[Push] New permission status: ${newStatus}`);
      if (newStatus !== "granted") {
        console.log("[Push] Permission denied");
        return false;
      }
    }

    // Get the current device's push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log(`[Push] Project ID: ${projectId}`);
    if (!projectId) {
      console.log("[Push] No project ID configured");
      return false;
    }

    const currentToken = await getExpoPushTokenWithRetry(projectId);
    console.log(`[Push] Current token: ${currentToken}`);
    if (!currentToken) {
      console.log("[Push] Failed to get token");
      return false;
    }

    // Fetch the stored token from the database
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single();

    console.log(`[Push] Stored token: ${profile?.push_token}`);

    // If the stored token is different (or null), save the new one
    if (profile?.push_token !== currentToken) {
      console.log("[Push] Token changed, saving new token...");
      await savePushToken(userId, currentToken);
      console.log("[Push] Push token updated for new device");
      return true;
    }

    console.log("[Push] Token unchanged");
    return false;
  } catch (error) {
    console.error("[Push] Failed to check/register push token:", error);
    captureError(error as Error, { context: "push_token_check" });
    return false;
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
