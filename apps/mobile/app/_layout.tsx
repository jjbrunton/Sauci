// Polyfills must be imported FIRST before any other React Native imports
import "../src/polyfills/web";

// Initialize Crashlytics early to capture all errors
import { initCrashlytics, setUserContext, clearUserContext } from "../src/lib/crashlytics";
initCrashlytics();

// Analytics imports (initialization deferred until app mounts)
import { initAnalytics, setUserId, clearUserId, logScreenView, Events } from "../src/lib/analytics";

// Import push notification utilities
import {
    clearPushToken,
    setupNotificationResponseListener,
    getInitialNotification,
    handleNotificationResponse,
} from "../src/lib/notifications";

import React, { useEffect, useRef, useState } from "react";
import { Platform, View, AppState, AppStateStatus, Modal, Text, StyleSheet, Pressable, TouchableOpacity } from "react-native";

// Suppress useLayoutEffect warning on server-side rendering
if (Platform.OS === "web" && typeof globalThis.window === "undefined") {
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
import { Ionicons } from "@expo/vector-icons";
// GestureHandlerRootView is only needed on native platforms
// On web, we use a simple View to avoid findNodeHandle errors
const GestureHandlerRootView = Platform.OS === "web"
    ? View
    : require("react-native-gesture-handler").GestureHandlerRootView;
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useAuthStore } from "../src/store";
import { supabase } from "../src/lib/supabase";
import { colors, spacing, radius, typography } from "../src/theme";
import { hasSeenGuestAccountWarning, markGuestAccountWarningSeen } from "../src/lib/guestAccountWarningSeen";

const queryClient = new QueryClient();

export default function RootLayout() {
    const { fetchUser, setUser, isAuthenticated, isAnonymous } = useAuthStore();
    const pathname = usePathname();
    const appState = useRef(AppState.currentState);
    const analyticsInitialized = useRef(false);

    const [showGuestWarning, setShowGuestWarning] = useState(false);
    const [checkingGuestWarning, setCheckingGuestWarning] = useState(false);

    const dismissGuestWarning = async () => {
        await markGuestAccountWarningSeen();
        setShowGuestWarning(false);
    };


    // Initialize analytics after native modules are ready
    useEffect(() => {
        if (!analyticsInitialized.current) {
            analyticsInitialized.current = true;
            initAnalytics();
            Events.appOpened("cold");
        }
    }, []);

    // Track screen views
    useEffect(() => {
        if (pathname) {
            logScreenView(pathname);
        }
    }, [pathname]);

    // Warn guest users (first time only) that accounts are not recoverable
    useEffect(() => {
        if (!isAuthenticated || !isAnonymous) return;
        if (checkingGuestWarning) return;
        if (pathname?.startsWith("/(auth)")) return;

        setCheckingGuestWarning(true);
        hasSeenGuestAccountWarning()
            .then((seen) => {
                if (!seen) {
                    setShowGuestWarning(true);
                }
            })
            .finally(() => setCheckingGuestWarning(false));
    }, [isAuthenticated, isAnonymous, pathname, checkingGuestWarning]);

    // Track warm starts when app comes back from background
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === "active") {
                Events.appOpened("warm");
            }
            appState.current = nextAppState;
        });

        return () => subscription.remove();
    }, []);

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
                if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
                    console.log('[Auth] Calling fetchUser...');
                    fetchUser();
                    // Set Crashlytics user context for error tracking
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

                <Modal
                    visible={showGuestWarning}
                    transparent
                    animationType="fade"
                    onRequestClose={dismissGuestWarning}
                >
                    <Pressable
                        style={styles.guestWarningOverlay}
                        onPress={dismissGuestWarning}
                    >
                        <Pressable style={styles.guestWarningCard} onPress={() => { }}>
                            <View style={styles.guestWarningHeader}>
                                <View style={styles.guestWarningIcon}>
                                    <Ionicons name="warning" size={22} color={colors.primary} />
                                </View>
                                <TouchableOpacity
                                    onPress={dismissGuestWarning}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={styles.guestWarningClose}
                                >
                                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.guestWarningTitle}>Your account isn't saved</Text>
                            <Text style={styles.guestWarningBody}>
                                If you delete the app or switch devices, you won't be able to recover this account.
                                Save your account now to protect your couple, matches, and purchases.
                            </Text>

                            <View style={styles.guestWarningActions}>
                                <TouchableOpacity
                                    style={styles.guestWarningPrimary}
                                    onPress={async () => {
                                        await markGuestAccountWarningSeen();
                                        setShowGuestWarning(false);
                                        router.push("/(app)/settings/save-account" as any);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.guestWarningPrimaryText}>Save account</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.guestWarningSecondary}
                                    onPress={async () => {
                                        await markGuestAccountWarningSeen();
                                        setShowGuestWarning(false);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.guestWarningSecondaryText}>Not now</Text>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            </GestureHandlerRootView>
        </QueryClientProvider>
    );
}

const styles = StyleSheet.create({
    guestWarningOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
    },
    guestWarningCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    guestWarningHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
    },
    guestWarningIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
    },
    guestWarningClose: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
    },
    guestWarningTitle: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    guestWarningBody: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    guestWarningActions: {
        gap: spacing.sm,
    },
    guestWarningPrimary: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: radius.md,
        alignItems: "center",
    },
    guestWarningPrimaryText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "600",
    },
    guestWarningSecondary: {
        backgroundColor: colors.glass.background,
        paddingVertical: 14,
        borderRadius: radius.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    guestWarningSecondaryText: {
        ...typography.subhead,
        color: colors.textSecondary,
        fontWeight: "600",
    },
});

