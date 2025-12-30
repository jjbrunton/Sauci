import analytics from "@react-native-firebase/analytics";
import { Platform } from "react-native";

let isInitialized = false;

export function initAnalytics() {
  if (__DEV__) {
    console.log("[Analytics] Disabled in development mode");
    return;
  }

  if (isInitialized) {
    return;
  }

  isInitialized = true;
  console.log("[Analytics] Firebase Analytics initialized");
}

// Log a custom event
export async function logEvent(
  name: string,
  params?: Record<string, string | number | boolean>
) {
  if (__DEV__) {
    console.log("[Analytics] Event:", name, params);
    return;
  }

  try {
    await analytics().logEvent(name, params);
  } catch (error) {
    console.warn("[Analytics] Failed to log event:", error);
  }
}

// Set user ID for tracking
export async function setUserId(userId: string) {
  if (__DEV__) {
    console.log("[Analytics] Set user ID:", userId);
    return;
  }

  try {
    await analytics().setUserId(userId);
  } catch (error) {
    console.warn("[Analytics] Failed to set user ID:", error);
  }
}

// Clear user ID on logout
export async function clearUserId() {
  if (__DEV__) {
    console.log("[Analytics] Cleared user ID");
    return;
  }

  try {
    await analytics().setUserId(null);
  } catch (error) {
    console.warn("[Analytics] Failed to clear user ID:", error);
  }
}

// Set user properties
export async function setUserProperties(
  properties: Record<string, string | null>
) {
  if (__DEV__) {
    console.log("[Analytics] Set user properties:", properties);
    return;
  }

  try {
    for (const [key, value] of Object.entries(properties)) {
      await analytics().setUserProperty(key, value);
    }
  } catch (error) {
    console.warn("[Analytics] Failed to set user properties:", error);
  }
}

// Log screen view
export async function logScreenView(screenName: string, screenClass?: string) {
  if (__DEV__) {
    console.log("[Analytics] Screen view:", screenName);
    return;
  }

  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass ?? screenName,
    });
  } catch (error) {
    console.warn("[Analytics] Failed to log screen view:", error);
  }
}

// Pre-defined event helpers for common actions
export const Events = {
  // Auth events
  signUp: (method: string) => logEvent("sign_up", { method }),
  signIn: (method: string) => logEvent("login", { method }),
  signOut: () => logEvent("sign_out"),

  // Onboarding events
  onboardingStart: () => logEvent("onboarding_start"),
  onboardingStageComplete: (stage: string) =>
    logEvent("onboarding_stage_complete", { stage }),
  onboardingComplete: () => logEvent("onboarding_complete"),

  // Pairing events
  coupleCreated: () => logEvent("couple_created"),
  coupleJoined: () => logEvent("couple_joined"),
  codeShared: () => logEvent("invite_code_shared"),
  pairingCancelled: () => logEvent("pairing_cancelled"),

  // Swipe/question events
  questionAnswered: (answer: string, packId?: string) =>
    logEvent("question_answered", { answer, pack_id: packId ?? "unknown" }),
  questionSkipped: () => logEvent("question_skipped"),
  matchCreated: (matchType: string) => logEvent("match_created", { match_type: matchType }),
  allQuestionsExhausted: () => logEvent("all_questions_exhausted"),

  // Chat events
  matchViewed: () => logEvent("match_viewed"),
  messageSent: () => logEvent("message_sent"),
  mediaUploaded: () => logEvent("chat_media_uploaded"),

  // Subscription events
  paywallShown: (source: string) => logEvent("paywall_shown", { source }),
  purchaseInitiated: (packageType: string) =>
    logEvent("purchase_initiated", { package_type: packageType }),
  purchaseCompleted: (packageType: string) =>
    logEvent("purchase", { package_type: packageType }),
  purchaseRestored: () => logEvent("purchase_restored"),

  // Pack events
  packEnabled: (packId: string) => logEvent("pack_enabled", { pack_id: packId }),
  packDisabled: (packId: string) => logEvent("pack_disabled", { pack_id: packId }),
};
