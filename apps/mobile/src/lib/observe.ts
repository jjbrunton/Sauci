// EAS Observe wrapper. Keeps expo-observe usage in one place and fails soft
// so a metrics problem never blocks app startup or crash reporting.
import { Observe } from "expo-observe";

type ErrorHandler = (error: unknown, isFatal: boolean) => void;

interface GlobalWithErrorUtils {
  ErrorUtils?: {
    getGlobalHandler(): ErrorHandler;
    setGlobalHandler(handler: ErrorHandler): void;
  };
}

let appStartedLogged = false;

/**
 * Logs the `app_started` custom event once per process lifetime. Safe to call
 * more than once; only the first call has an effect.
 */
export function logAppStarted() {
  if (appStartedLogged) return;
  appStartedLogged = true;

  try {
    Observe.logEvent("app_started");
  } catch (error) {
    console.warn("[Observe] Failed to log app_started:", error);
  }
}

let globalErrorHandlerInstalled = false;

/**
 * Installs a global fatal JS error handler that records an `xprem_js_crash`
 * Observe event and then always delegates to whatever handler was previously
 * registered (RN's default redbox handler, or another handler such as
 * Crashlytics's, if one is installed first). Existing crash reporting is
 * never replaced, only observed.
 */
export function installObserveGlobalErrorHandler() {
  if (globalErrorHandlerInstalled) return;

  const errorUtils = (global as GlobalWithErrorUtils).ErrorUtils;
  if (!errorUtils) {
    console.warn("[Observe] ErrorUtils is unavailable; xprem_js_crash will not be recorded.");
    return;
  }

  globalErrorHandlerInstalled = true;
  const previousHandler = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const message = error instanceof Error ? error.message : String(error);
      Observe.logEvent("xprem_js_crash", {
        severity: "fatal",
        body: message,
        attributes: { isFatal: Boolean(isFatal) },
      });
    } catch (observeError) {
      console.warn("[Observe] Failed to log xprem_js_crash:", observeError);
    }

    previousHandler(error, isFatal);
  });
}
