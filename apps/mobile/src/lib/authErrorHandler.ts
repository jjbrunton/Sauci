import { router } from "expo-router";
import { supabase } from "./supabase";
// Import directly from authStore to avoid circular dependency with store/index.ts
import { useAuthStore } from "../store/authStore";

/**
 * Handles authentication errors from edge function calls.
 *
 * When a 401 error occurs, this function:
 * 1. Attempts to refresh the session
 * 2. If refresh fails (session was deleted server-side), signs the user out and navigates to login
 *
 * @returns true if the error was handled and user should retry, false if signed out
 */
export async function handleAuthError(error: any): Promise<boolean> {
    // Check if this is a 401 authentication error
    const is401 = error?.status === 401 ||
                  error?.message?.includes("401") ||
                  error?.message?.includes("session") ||
                  error?.message?.includes("unauthorized");

    if (!is401) {
        return false;
    }

    console.log("[AuthErrorHandler] Detected auth error, attempting session refresh");

    try {
        // Try to refresh the session
        const { data, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !data.session) {
            console.log("[AuthErrorHandler] Session refresh failed, signing out:", refreshError?.message);
            // Session is invalid - sign the user out and navigate to login
            await useAuthStore.getState().signOut();
            // Explicitly navigate to login to ensure user doesn't get stuck
            router.replace("/(auth)/login");
            return false;
        }

        console.log("[AuthErrorHandler] Session refreshed successfully");
        return true;
    } catch (e) {
        console.error("[AuthErrorHandler] Error during refresh:", e);
        await useAuthStore.getState().signOut();
        router.replace("/(auth)/login");
        return false;
    }
}

/**
 * Wrapper for edge function invocation with automatic auth error handling.
 *
 * @param functionName - Name of the edge function to invoke
 * @param options - Options including body and headers
 * @param retryOnAuthError - Whether to retry after refreshing auth (default: true)
 * @returns The result of the function invocation
 */
export async function invokeWithAuthRetry(
    functionName: string,
    options: { body?: any; headers?: Record<string, string> } = {},
    retryOnAuthError = true
): Promise<{ data: any; error: any }> {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        console.error("[AuthErrorHandler] No valid session for function call");
        return { data: null, error: { message: "No valid session" } };
    }

    // Make the request
    const result = await supabase.functions.invoke(functionName, {
        body: options.body,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${session.access_token}`,
        },
    });

    // Check for auth error
    if (result.error) {
        const is401 = result.error?.status === 401 ||
                      result.error?.message?.includes("401") ||
                      result.error?.context?.status === 401;

        if (is401 && retryOnAuthError) {
            console.log("[AuthErrorHandler] Got 401, attempting refresh and retry");
            const canRetry = await handleAuthError(result.error);

            if (canRetry) {
                // Get new session and retry
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (newSession?.access_token) {
                    return supabase.functions.invoke(functionName, {
                        body: options.body,
                        headers: {
                            ...options.headers,
                            Authorization: `Bearer ${newSession.access_token}`,
                        },
                    });
                }
            }
        }
    }

    return result;
}
