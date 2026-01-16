import { Platform } from "react-native";
import Constants from "expo-constants";
// Import default export to ensure namespace registration runs
import analytics, {
  getAnalytics,
  logEvent as firebaseLogEvent,
  setUserId as firebaseSetUserId,
  setUserProperty,
  setAnalyticsCollectionEnabled,
  resetAnalyticsData,
  FirebaseAnalyticsTypes,
} from "@react-native-firebase/analytics";

// Force the analytics module to be retained (prevents tree-shaking)
const _analyticsModule = analytics;

let isInitialized = false;
let analyticsInstance: FirebaseAnalyticsTypes.Module | null = null;
let analyticsUnavailable = false;
let analyticsUnavailableLogged = false;

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof (error as { message?: unknown }).message === "string") {
    return (error as { message?: string }).message || "";
  }
  return "";
}

function isAnalyticsSupported(): boolean {
  if (Platform.OS === "web") return false;
  if (Constants.appOwnership === "expo") return false;
  return true;
}

function logAnalyticsUnavailableOnce(reason: string) {
  if (analyticsUnavailableLogged) return;
  analyticsUnavailableLogged = true;
  if (__DEV__) console.log("[Analytics] " + reason);
}

function getAnalyticsInstance(): FirebaseAnalyticsTypes.Module | null {
  if (analyticsUnavailable) {
    return null;
  }

  if (!isAnalyticsSupported()) {
    analyticsUnavailable = true;
    logAnalyticsUnavailableOnce("Skipping Firebase Analytics on Expo Go or web.");
    return null;
  }

  if (analyticsInstance) {
    return analyticsInstance;
  }

  try {
    analyticsInstance = getAnalytics();
    return analyticsInstance;
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.includes("module could not be found")) {
      analyticsUnavailable = true;
      logAnalyticsUnavailableOnce(
        "Firebase Analytics native module missing. Rebuild with a dev client or native app."
      );
      return null;
    }
    console.warn("[Analytics] Failed to get analytics instance:", error);
    return null;
  }
}

export async function initAnalytics() {
  if (isInitialized) {
    return;
  }

  // Skip initialization in non-RN environments (e.g., during tsc/Node.js)
  if (typeof window === "undefined" && typeof global !== "undefined" && !("__BUNDLE_START_TIME__" in global)) {
    return;
  }

  try {
    const analytics = getAnalyticsInstance();
    if (analytics) {
      await setAnalyticsCollectionEnabled(analytics, true);
      isInitialized = true;
      console.log("[Analytics] Firebase Analytics initialized");
    }
  } catch (error) {
    console.warn("[Analytics] Failed to initialize Firebase Analytics:", error);
  }
}

// Log a custom event
export function logEvent(
  name: string,
  params?: Record<string, string | number | boolean>
) {
  try {
    if (__DEV__) console.log("[Analytics] Event:", name, params);
    const analytics = getAnalyticsInstance();
    if (analytics) {
      firebaseLogEvent(analytics, name, params);
    }
  } catch (error) {
    console.warn("[Analytics] Failed to log event:", error);
  }
}

// Set user ID for tracking
export function setUserId(userId: string) {
  try {
    if (__DEV__) console.log("[Analytics] Set user ID:", userId);
    const analytics = getAnalyticsInstance();
    if (analytics) {
      firebaseSetUserId(analytics, userId);
    }
  } catch (error) {
    console.warn("[Analytics] Failed to set user ID:", error);
  }
}

// Clear user ID on logout
export function clearUserId() {
  try {
    if (__DEV__) console.log("[Analytics] Cleared user ID");
    const analytics = getAnalyticsInstance();
    if (analytics) {
      firebaseSetUserId(analytics, null);
      resetAnalyticsData(analytics);
    }
  } catch (error) {
    console.warn("[Analytics] Failed to clear user ID:", error);
  }
}

// Set user properties
export function setUserProperties(
  properties: Record<string, string | null>
) {
  try {
    if (__DEV__) console.log("[Analytics] Set user properties:", properties);
    const analytics = getAnalyticsInstance();
    if (analytics) {
      // Firebase Analytics requires setting user properties one at a time
      for (const [key, value] of Object.entries(properties)) {
        setUserProperty(analytics, key, value);
      }
    }
  } catch (error) {
    console.warn("[Analytics] Failed to set user properties:", error);
  }
}

// Log screen view
export function logScreenView(screenName: string, screenClass?: string) {
  try {
    if (__DEV__) console.log("[Analytics] Screen view:", screenName);
    const analytics = getAnalyticsInstance();
    if (analytics) {
      firebaseLogEvent(analytics, "screen_view", {
        screen_name: screenName,
        screen_class: screenClass ?? screenName,
      });
    }
  } catch (error) {
    console.warn("[Analytics] Failed to log screen view:", error);
  }
}

// Flush events (useful before app backgrounding)
export function flush() {
  // Firebase Analytics batches and sends events automatically
  // No manual flush needed, but we keep the function for API compatibility
  if (__DEV__) console.log("[Analytics] Flush called (no-op for Firebase)");
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

  // App lifecycle events
  appOpened: (type: "cold" | "warm") => logEvent("app_opened", { type }),

  // Profile events
  profileUpdated: (fields: string[]) => logEvent("profile_updated", { fields: fields.join(",") }),
  avatarUploaded: () => logEvent("avatar_uploaded"),

  // Notification events
  notificationPermissionGranted: () => logEvent("notification_permission_granted"),
  notificationPermissionDenied: () => logEvent("notification_permission_denied"),

  // Relationship events
  relationshipEnded: () => logEvent("relationship_ended"),
  accountDeleted: () => logEvent("account_deleted"),

  // Milestone events
  firstMatch: () => logEvent("first_match"),
  milestoneMatch: (count: number) => logEvent("milestone_match", { match_count: count }),

  // Invite events
  inviteCodeCopied: () => logEvent("invite_code_copied"),

  // Tutorial events
  tutorialStarted: (tutorial: "swipe" | "matches") =>
    logEvent("tutorial_started", { tutorial }),
  tutorialStepViewed: (tutorial: "swipe" | "matches", step: number, stepName: string) =>
    logEvent("tutorial_step_viewed", { tutorial, step, step_name: stepName }),
  tutorialCompleted: (tutorial: "swipe" | "matches") =>
    logEvent("tutorial_completed", { tutorial }),
  tutorialSkipped: (tutorial: "swipe" | "matches", atStep: number) =>
    logEvent("tutorial_skipped", { tutorial, at_step: atStep }),
};
