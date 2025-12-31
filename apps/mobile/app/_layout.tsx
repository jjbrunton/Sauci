// Web polyfills must be imported FIRST before any other React Native imports
import "../src/polyfills/web";

// Initialize Sentry early to capture all errors
import { initSentry, setUserContext, clearUserContext } from "../src/lib/sentry";
initSentry();

// Initialize Analytics
import { initAnalytics, setUserId, clearUserId, logScreenView } from "../src/lib/analytics";
initAnalytics();

// Import push notification utilities
import {
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

import { Stack, router, usePathname } from "expo-router";
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
    const pathname = usePathname();

    // Track screen views
    useEffect(() => {
        if (pathname) {
            logScreenView(pathname);
        }
    }, [pathname]);

    useEffect(() => {
        // Fetch user on mount
        fetchUser();

        // Handle initial URL if app was opened via deep link
        const handleDeepLink = async (url: string | null) => {
            console.log('[DeepLink] handleDeepLink called with URL:', url);
            if (!url) return;

            try {
                // Parse the URL to extract auth parameters
                const parsedUrl = new URL(url);
                console.log('[DeepLink] Parsed URL:', {
                    protocol: parsedUrl.protocol,
                    host: parsedUrl.host,
                    pathname: parsedUrl.pathname,
                    search: parsedUrl.search,
                    hash: parsedUrl.hash,
                });
                const params = new URLSearchParams(parsedUrl.search);

                // Also check hash fragment (some auth flows use fragments)
                const hashParams = new URLSearchParams(parsedUrl.hash.replace('#', ''));

                // Get token parameters - check both query and hash
                const accessToken = params.get('access_token') || hashParams.get('access_token');
                const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token');
                const tokenHash = params.get('token_hash') || hashParams.get('token_hash');
                const type = params.get('type') || hashParams.get('type');

                console.log('[DeepLink] Extracted params:', {
                    accessToken: accessToken ? 'present' : 'missing',
                    refreshToken: refreshToken ? 'present' : 'missing',
                    tokenHash: tokenHash ? 'present' : 'missing',
                    type,
                });

                if (accessToken && refreshToken) {
                    // OAuth flow - set session directly
                    console.log('[DeepLink] Setting session with tokens');
                    const { data, error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    console.log('[DeepLink] setSession result:', {
                        hasSession: !!data?.session,
                        userId: data?.session?.user?.id,
                        error: error?.message
                    });
                } else if (tokenHash && type) {
                    // Magic link / email verification flow - verify the OTP
                    console.log('[DeepLink] Verifying OTP with token_hash and type:', type);
                    const { data, error } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: type as 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email',
                    });
                    console.log('[DeepLink] verifyOtp result:', { data: !!data?.session, error: error?.message });

                    // If this is a password recovery flow, navigate to reset password screen
                    if (type === 'recovery' && data?.session && !error) {
                        console.log('[DeepLink] Password recovery flow - navigating to reset-password');
                        router.replace("/(auth)/reset-password");
                    }
                } else {
                    // Fallback for web or other scenarios
                    console.log('[DeepLink] No auth params found, falling back to getSession');
                    await supabase.auth.getSession();
                }
            } catch (error) {
                console.error('[DeepLink] Error handling deep link:', error);
                // Still try to get session as fallback
                await supabase.auth.getSession();
            }
        };

        // Get initial URL
        Linking.getInitialURL().then((url) => {
            console.log('[DeepLink] getInitialURL returned:', url);
            handleDeepLink(url);
        });

        // Listen for new deep links while app is open
        const linkingSubscription = Linking.addEventListener("url", (event) => {
            console.log('[DeepLink] URL event listener triggered with:', event.url);
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
                console.log('[Auth] onAuthStateChange:', event, 'hasSession:', !!session, 'userId:', session?.user?.id);
                if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                    console.log('[Auth] Calling fetchUser...');
                    fetchUser();
                    // Set Sentry user context for error tracking
                    if (session?.user) {
                        setUserContext(session.user.id, session.user.email);
                        // Set Analytics user ID
                        setUserId(session.user.id);
                    }
                } else if (event === "SIGNED_OUT") {
                    // Clear push token before clearing user state
                    const userId = useAuthStore.getState().user?.id;
                    if (userId) {
                        await clearPushToken(userId);
                    }
                    setUser(null);
                    clearUserContext();
                    clearUserId();
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
