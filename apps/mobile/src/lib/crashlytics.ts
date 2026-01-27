import { Platform } from "react-native";
import Constants from "expo-constants";
import crashlytics from "@react-native-firebase/crashlytics";

let isInitialized = false;
let crashlyticsUnavailable = false;
let crashlyticsUnavailableLogged = false;

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof (error as { message?: unknown }).message === "string") {
    return (error as { message?: string }).message || "";
  }
  return "";
}

function isCrashlyticsSupported(): boolean {
  if (Platform.OS === "web") return false;
  if (Constants.appOwnership === "expo") return false;
  return true;
}

function logCrashlyticsUnavailableOnce(reason: string) {
  if (crashlyticsUnavailableLogged) return;
  crashlyticsUnavailableLogged = true;
  if (__DEV__) console.log("[Crashlytics] " + reason);
}

function getCrashlyticsInstance(): ReturnType<typeof crashlytics> | null {
  if (crashlyticsUnavailable) {
    return null;
  }

  if (!isCrashlyticsSupported()) {
    crashlyticsUnavailable = true;
    logCrashlyticsUnavailableOnce("Skipping Firebase Crashlytics on Expo Go or web.");
    return null;
  }

  try {
    return crashlytics();
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.includes("module could not be found")) {
      crashlyticsUnavailable = true;
      logCrashlyticsUnavailableOnce(
        "Firebase Crashlytics native module missing. Rebuild with a dev client or native app."
      );
      return null;
    }
    console.warn("[Crashlytics] Failed to get crashlytics instance:", error);
    return null;
  }
}

export function initCrashlytics() {
  if (isInitialized) return;

  try {
    const instance = getCrashlyticsInstance();
    if (instance) {
      instance.setCrashlyticsCollectionEnabled(true);
      isInitialized = true;
      console.log("[Crashlytics] Firebase Crashlytics initialized");
    }
  } catch (error) {
    console.warn("[Crashlytics] Failed to initialize:", error);
  }
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  try {
    const instance = getCrashlyticsInstance();
    if (!instance) return;

    if (context) {
      for (const [key, value] of Object.entries(context)) {
        instance.setAttribute(key, String(value ?? ""));
      }
    }
    instance.recordError(error);
  } catch (e) {
    console.warn("[Crashlytics] Failed to capture error:", e);
  }
}

export function setUserContext(userId: string, email?: string) {
  try {
    const instance = getCrashlyticsInstance();
    if (!instance) return;

    instance.setUserId(userId);
    if (email) {
      instance.setAttribute("email", email);
    }
  } catch (error) {
    console.warn("[Crashlytics] Failed to set user context:", error);
  }
}

export function clearUserContext() {
  try {
    const instance = getCrashlyticsInstance();
    if (!instance) return;

    instance.setUserId("");
    instance.setAttribute("email", "");
  } catch (error) {
    console.warn("[Crashlytics] Failed to clear user context:", error);
  }
}

export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  try {
    const instance = getCrashlyticsInstance();
    if (!instance) return;

    instance.log(`[${category}] ${message}${data ? " " + JSON.stringify(data) : ""}`);
  } catch (error) {
    console.warn("[Crashlytics] Failed to add breadcrumb:", error);
  }
}
