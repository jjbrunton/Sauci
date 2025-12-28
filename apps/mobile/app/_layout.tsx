// Web polyfills must be imported FIRST before any other React Native imports
import "../src/polyfills/web";

// Initialize Sentry early to capture all errors
import { initSentry, setUserContext, clearUserContext } from "../src/lib/sentry";
initSentry();

// Import push notification utilities
import {
    registerForPushNotificationsAsync,
    savePushToken,
    clearPushToken,
    setupNotificationResponseListener,
    getInitialNotification,
    handleNotificationResponse,
} from "../src/lib/notifications";

import React, { useEffect } from "react";
import { Platform, View } from "react-native";

// Suppress useLayoutEffect warning on server-side rendering
if (Platform.OS === "web" && typeof window === "undefined") {
    React.useLayoutEffect = useEffect;
    // Also silence the warning in case some libraries ignore the monkey-patch
    const originalError = console.error;
    console.error = (...args) => {
        if (typeof args[0] === "string" && args[0].includes("useLayoutEffect does nothing on the server")) {
            return;
        }
        originalError(...args);
    };
}

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
// GestureHandlerRootView is only needed on native platforms
// On web, we use a simple View to avoid findNodeHandle errors
const GestureHandlerRootView = Platform.OS === "web"
    ? View
    : require("react-native-gesture-handler").GestureHandlerRootView;
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useAuthStore } from "../src/store";
import { supabase } from "../src/lib/supabase";

const queryClient = new QueryClient();

export default function RootLayout() {
    const { fetchUser, setUser } = useAuthStore();

    useEffect(() => {
        // Fetch user on mount
        fetchUser();

        // Handle initial URL if app was opened via deep link
        const handleDeepLink = async (url: string | null) => {
            if (url) {
                // Supabase needs to handle the URL to extract session
                // getSession() will automatically check window.location on web if detectSessionInUrl is true
                // For native, we rely on onAuthStateChange or manual processing if needed
                await supabase.auth.getSession();
            }
        };

        // Get initial URL
        Linking.getInitialURL().then(handleDeepLink);

        // Listen for new deep links while app is open
        const linkingSubscription = Linking.addEventListener("url", (event) => {
            handleDeepLink(event.url);
        });

        // Set up push notification response listener (for taps while app is running)
        const notificationSubscription = setupNotificationResponseListener();

        // Check if app was opened from a notification tap (cold start)
        getInitialNotification().then((response) => {
            if (response) {
                handleNotificationResponse(response);
            }
        });

        // Listen for auth changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                    fetchUser();
                    // Set Sentry user context for error tracking
                    if (session?.user) {
                        setUserContext(session.user.id, session.user.email);

                        // Register for push notifications and save token
                        const token = await registerForPushNotificationsAsync();
                        if (token) {
                            await savePushToken(session.user.id, token);
                        }
                    }
                } else if (event === "SIGNED_OUT") {
                    // Clear push token before clearing user state
                    const userId = useAuthStore.getState().user?.id;
                    if (userId) {
                        await clearPushToken(userId);
                    }
                    setUser(null);
                    clearUserContext();
                    // Clear React Query cache
                    queryClient.clear();
                }
            }
        );

        return () => {
            linkingSubscription.remove();
            authSubscription.unsubscribe();
            notificationSubscription.remove();
        };
    }, []);


    return (
        <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style="light" />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: "#1a1a2e" },
                    }}
                />
            </GestureHandlerRootView>
        </QueryClientProvider>
    );
}
