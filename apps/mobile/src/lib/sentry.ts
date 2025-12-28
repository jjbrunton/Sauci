import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enabled: !__DEV__, // Only enable in production
    environment: __DEV__ ? "development" : "production",
    release: Constants.expoConfig?.version ?? "1.0.0",
    dist: Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString(),

    // Performance monitoring
    tracesSampleRate: 0.2, // 20% of transactions for performance

    // Session tracking
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,

    // Capture unhandled promise rejections
    enableNative: true,

    // Filter out noisy errors
    beforeSend(event) {
      // Filter out network errors that are expected (e.g., user offline)
      if (event.exception?.values?.[0]?.value?.includes("Network request failed")) {
        return null;
      }
      return event;
    },
  });
}

// Helper to capture errors with context
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext("additional", context);
  }
  Sentry.captureException(error);
}

// Set user context when they log in
export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({
    id: userId,
    email,
  });
}

// Clear user context on logout
export function clearUserContext() {
  Sentry.setUser(null);
}

// Add breadcrumb for debugging
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
}

export { Sentry };
