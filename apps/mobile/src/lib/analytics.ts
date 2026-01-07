import PostHog from "posthog-react-native";

let posthog: PostHog | null = null;
let isInitialized = false;

export async function initAnalytics() {
  if (isInitialized) {
    return;
  }

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    console.warn("[Analytics] PostHog API key not configured");
    return;
  }

  try {
    posthog = new PostHog(apiKey, {
      host,
      // Disable automatic capture in production for privacy
      captureAppLifecycleEvents: true,
    });

    isInitialized = true;
    console.log("[Analytics] PostHog initialized");
  } catch (error) {
    console.warn("[Analytics] Failed to initialize PostHog:", error);
  }
}

// Log a custom event
export function logEvent(
  name: string,
  params?: Record<string, string | number | boolean>
) {
  try {
    if (__DEV__) console.log("[Analytics] Event:", name, params);
    posthog?.capture(name, params);
  } catch (error) {
    console.warn("[Analytics] Failed to log event:", error);
  }
}

// Set user ID for tracking
export function setUserId(userId: string) {
  try {
    if (__DEV__) console.log("[Analytics] Set user ID:", userId);
    posthog?.identify(userId);
  } catch (error) {
    console.warn("[Analytics] Failed to set user ID:", error);
  }
}

// Clear user ID on logout
export function clearUserId() {
  try {
    if (__DEV__) console.log("[Analytics] Cleared user ID");
    posthog?.reset();
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
    // Filter out null values for PostHog
    const filteredProps: Record<string, string> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value !== null) {
        filteredProps[key] = value;
      }
    }
    posthog?.capture("$set", { $set: filteredProps });
  } catch (error) {
    console.warn("[Analytics] Failed to set user properties:", error);
  }
}

// Log screen view
export function logScreenView(screenName: string, screenClass?: string) {
  try {
    if (__DEV__) console.log("[Analytics] Screen view:", screenName);
    posthog?.screen(screenName, { screen_class: screenClass ?? screenName });
  } catch (error) {
    console.warn("[Analytics] Failed to log screen view:", error);
  }
}

// Flush events (useful before app backgrounding)
export function flush() {
  try {
    posthog?.flush();
  } catch (error) {
    console.warn("[Analytics] Failed to flush:", error);
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
