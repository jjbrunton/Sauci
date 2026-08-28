import { Tabs, useRouter, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet, Platform, Text, Pressable, Animated, AppState } from "react-native";
import { BlurView } from "expo-blur";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore, useMatchStore, useMessageStore, useSubscriptionStore, usePacksStore, useStreakStore } from "../../src/store";
import { colors, radius, spacing, typography, shadows } from "../../src/theme";
import { authClient } from "../../src/lib/authClient";
import { isBiometricEnabled } from "../../src/lib/biometricAuth";
import { checkAndRegisterPushToken } from "../../src/lib/notifications";
import { syncBadgeCount } from "../../src/lib/badge";
import { BiometricLockScreen } from "../../src/components/BiometricLockScreen";
import { Events } from "../../src/lib/analytics";
import { needsOnboarding } from "../../src/constants/onboarding";
import type { Database } from "../../src/types/supabase";

type Message = Database["public"]["Tables"]["messages"]["Row"];

function MessageToastPreview({
    message,
}: {
    message: Message;
}) {
    if (message.media_path) {
        const fallback = message.media_type === 'video' ? 'Sent a video' : 'Sent an image';
        return (
            <Text style={styles.messageToastBody} numberOfLines={1}>
                {fallback}
            </Text>
        );
    }

    return (
        <Text style={styles.messageToastBody} numberOfLines={1}>
            {message.content ?? 'New message'}
        </Text>
    );
}

function TabBarBackground() {
    // Only use BlurView on iOS - Android experimental blur causes white overlay artifacts
    // The solid rgba background in tabBarStyle provides the visual effect on Android
    if (Platform.OS === 'ios') {
        return (
            <>
                <BlurView
                    intensity={80}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14, 14, 17, 0.85)' }]} />
            </>
        );
    }
    return null;
}

export default function AppLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { isAuthenticated, isLoading, user, signOut, updateLastActive } = useAuthStore();
    const { newMatchesCount, pendingQuestions, fetchPendingQuestions, fetchMatches } = useMatchStore();
    const { unreadCount, lastMessage, fetchUnreadCount, clearLastMessage } = useMessageStore();
    const { fetchEnabledPacks } = usePacksStore();
    const { initializeRevenueCat, refreshSubscriptionStatus } = useSubscriptionStore();
    const { fetchStreak } = useStreakStore();
    const messageToastAnim = useRef(new Animated.Value(-100)).current;
    const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const hasCheckedInitialBiometric = useRef(false);
    const wentToBackgroundAt = useRef<number | null>(null);
    const knownMatchIdsRef = useRef<Set<string>>(new Set());
    const matchPollInitializedRef = useRef(false);

    // Check if we're on screens that should hide the tab bar
    const segmentStrings = segments as string[];
    const isOnOnboarding = segmentStrings.includes("onboarding");
    const isOnPairing = segmentStrings.includes("pairing");
    const isOnChat = segmentStrings.includes("chat");
    const isOnLiveDraw = segmentStrings.includes("live-draw");
    const isOnSettingsSubscreen = segmentStrings.includes("settings") && segmentStrings.length > 2;
    const shouldHideTabBar = isOnOnboarding || isOnPairing || isOnChat || isOnLiveDraw || isOnSettingsSubscreen;

    // Redirect to login when not authenticated, or to onboarding if not completed/outdated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace("/(auth)/login");
        } else if (!isLoading && isAuthenticated && user && needsOnboarding(user.onboarding_completed, user.onboarding_version) && !isOnOnboarding) {
            router.replace("/(app)/onboarding");
        }
    }, [isLoading, isAuthenticated, user, router, isOnOnboarding]);

    // Check session validity on mount and when app comes to foreground
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await authClient.auth.getSession();
            if (!session) {
                // No valid session - sign out to clear local state
                signOut();
            }
        };

        // Check immediately
        checkSession();

        // Update last active timestamp on mount
        updateLastActive();

        // Check when app comes to foreground
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkSession();
                // Update last active timestamp when app comes to foreground
                updateLastActive();
                if (user?.id && Platform.OS !== "web") {
                    void refreshSubscriptionStatus();
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [signOut, updateLastActive, user?.id, refreshSubscriptionStatus]);

    // Handle biometric lock when app goes to background/foreground
    useEffect(() => {
        // Check if biometric should be shown on initial mount
        const checkInitialBiometric = async () => {
            if (hasCheckedInitialBiometric.current) return;
            hasCheckedInitialBiometric.current = true;

            const enabled = await isBiometricEnabled();
            if (enabled && isAuthenticated) {
                setIsLocked(true);
            }
        };

        if (isAuthenticated && !isLoading) {
            checkInitialBiometric();
        }

        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            // Track when app goes to background (not just inactive)
            if (nextAppState === 'background') {
                wentToBackgroundAt.current = Date.now();
            }

            // When app becomes active, check if we should lock
            if (nextAppState === 'active' && isAuthenticated && !isLocked) {
                // Only lock if we actually went to background (not just inactive from modal/control center)
                // and we were in background for at least 1 second
                if (wentToBackgroundAt.current) {
                    const timeInBackground = Date.now() - wentToBackgroundAt.current;
                    wentToBackgroundAt.current = null;

                    if (timeInBackground > 1000) {
                        const enabled = await isBiometricEnabled();
                        if (enabled) {
                            setIsLocked(true);
                        }
                    }
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [isAuthenticated, isLoading, isLocked]);

    const handleBiometricUnlock = useCallback(() => {
        setIsLocked(false);
    }, []);

    // Fetch unread message count on mount
    useEffect(() => {
        if (user?.id) {
            fetchUnreadCount();
        }
    }, [user?.id, fetchUnreadCount]);

    // Fetch streak data when user is in a couple
    useEffect(() => {
        if (user?.couple_id) {
            fetchStreak();
        }
    }, [user?.couple_id, fetchStreak]);

    // Fetch pending questions (Your Turn) when user is in a couple
    useEffect(() => {
        if (user?.couple_id) {
            fetchPendingQuestions();
        }
    }, [user?.couple_id, fetchPendingQuestions]);

    // Sync app icon badge count whenever matches, messages, or pending questions change
    useEffect(() => {
        syncBadgeCount(newMatchesCount + pendingQuestions.length, unreadCount);
    }, [newMatchesCount, unreadCount, pendingQuestions.length]);

    // Initialize RevenueCat for subscription management (iOS and Android only)
    useEffect(() => {
        if (user?.id && Platform.OS !== "web") {
            initializeRevenueCat(user.id);
        }
    }, [user?.id, initializeRevenueCat]);

    // Check and register push token for this device
    // This handles the case where user onboarded on a different device
    useEffect(() => {
        if (user?.id && user?.onboarding_completed) {
            checkAndRegisterPushToken(user.id);
        }
    }, [user?.id, user?.onboarding_completed]);

    // Poll the self-hosted API for profile, match, pending-question and pack changes.
    // This replaces the former Supabase Postgres change subscriptions.
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        matchPollInitializedRef.current = false;
        knownMatchIdsRef.current = new Set();

        const poll = async () => {
            await Promise.allSettled([
                useAuthStore.getState().fetchUser(),
                ...(user.couple_id ? [fetchMatches(true), fetchPendingQuestions(), fetchEnabledPacks()] : []),
            ]);
            if (cancelled || !user.couple_id) return;
            const refreshed = useMatchStore.getState().matches;
            if (matchPollInitializedRef.current) {
                const added = refreshed.filter(item => !knownMatchIdsRef.current.has(item.id));
                for (const item of added) Events.matchCreated(item.match_type || "unknown");
                const previousCount = knownMatchIdsRef.current.size;
                if (previousCount === 0 && added.length > 0) Events.firstMatch();
                else if (added.length > 0 && refreshed.length % 10 === 0) Events.milestoneMatch(refreshed.length);
            }
            knownMatchIdsRef.current = new Set(refreshed.map(item => item.id));
            matchPollInitializedRef.current = true;
        };

        void poll();
        const timer = setInterval(() => void poll(), 5_000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [user?.id, user?.couple_id, fetchMatches, fetchPendingQuestions, fetchEnabledPacks]);

    // Poll the self-hosted API for unread chat state. Chat screens perform their
    // own message polling; this keeps the global badge current without Supabase Realtime.
    useEffect(() => {
        if (!user?.couple_id) return;
        const timer = setInterval(() => void fetchUnreadCount(), 3_000);
        return () => clearInterval(timer);
    }, [user?.couple_id, fetchUnreadCount]);

    // Animate message toast when lastMessage changes
    useEffect(() => {
        if (lastMessage) {
            // Clear any existing timeout
            if (messageTimeoutRef.current) {
                clearTimeout(messageTimeoutRef.current);
            }

            // Slide in
            Animated.spring(messageToastAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();

            // Auto-dismiss after 4 seconds
            messageTimeoutRef.current = setTimeout(() => {
                dismissMessageToast();
            }, 4000);
        }

        return () => {
            if (messageTimeoutRef.current) {
                clearTimeout(messageTimeoutRef.current);
            }
        };
    }, [lastMessage]);

    const dismissMessageToast = useCallback(() => {
        Animated.timing(messageToastAnim, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            clearLastMessage();
        });
    }, [messageToastAnim, clearLastMessage]);

    const handleMessageToastPress = useCallback(() => {
        if (lastMessage?.match_id) {
            dismissMessageToast();
            router.push(`/(app)/chat/${lastMessage.match_id}`);
        }
    }, [lastMessage, dismissMessageToast, router]);

    // Show loading state while checking authentication or redirecting to onboarding
    if (isLoading || !isAuthenticated || (user && needsOnboarding(user.onboarding_completed, user.onboarding_version) && !isOnOnboarding)) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarBackground: () => <TabBarBackground />,
                    tabBarStyle: shouldHideTabBar ? { display: 'none' } : {
                        position: 'absolute',
                        backgroundColor: 'rgba(14, 14, 17, 0.85)',
                        borderTopColor: 'rgba(233, 69, 96, 0.2)', // primary brand color
                        borderTopWidth: 1,
                        paddingTop: 8,
                        paddingBottom: Platform.OS === 'ios' ? 28 : 8,
                        height: Platform.OS === 'ios' ? 88 : 64,
                        elevation: 0,
                    },
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textSecondary,
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontWeight: "500",
                        letterSpacing: 0.5,
                    },
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: "Home",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="home" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="swipe"
                    options={{
                        href: null, // Hide from tab bar - accessed from home screen
                    }}
                />
                <Tabs.Screen
                    name="matches"
                    options={{
                        title: "Matches",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="heart" size={size} color={color} />
                        ),
                        tabBarBadge: (newMatchesCount + unreadCount + pendingQuestions.length) > 0 ? (newMatchesCount + unreadCount + pendingQuestions.length) : undefined,
                        tabBarBadgeStyle: {
                            backgroundColor: colors.premium.rose,
                            fontSize: 9,
                            fontWeight: '600',
                            minWidth: 16,
                            height: 16,
                            borderRadius: 8,
                        },
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: "Settings",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="settings" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="pairing"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
                <Tabs.Screen
                    name="chat/[id]"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
                <Tabs.Screen
                    name="onboarding"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
                <Tabs.Screen
                    name="dares"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
                <Tabs.Screen
                    name="quiz"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
                <Tabs.Screen
                    name="my-answers"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
                <Tabs.Screen
                    name="live-draw"
                    options={{
                        href: null, // Hide from tab bar
                    }}
                />
            </Tabs>

            {/* Message Toast Notification */}
            {lastMessage && (
                <Animated.View
                    style={[
                        styles.messageToast,
                        { transform: [{ translateY: messageToastAnim }] },
                    ]}
                >
                    <Pressable style={styles.messageToastContent} onPress={handleMessageToastPress}>
                        <View style={styles.messageToastIcon}>
                            <Ionicons name="chatbubble" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.messageToastText}>
                            <Text style={styles.messageToastTitle} numberOfLines={1}>
                                New message
                            </Text>
                            <MessageToastPreview message={lastMessage} />
                        </View>
                        <Pressable onPress={dismissMessageToast} hitSlop={8}>
                            <Ionicons name="close" size={20} color={colors.textTertiary} />
                        </Pressable>
                    </Pressable>
                </Animated.View>
            )}

            {/* Biometric Lock Screen */}
            <BiometricLockScreen
                visible={isLocked}
                onUnlock={handleBiometricUnlock}
            />
        </>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    messageToast: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: spacing.md,
        right: spacing.md,
        zIndex: 1000,
    },
    messageToastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        ...shadows.lg,
    },
    messageToastIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    messageToastText: {
        flex: 1,
        marginRight: spacing.sm,
    },
    messageToastTitle: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: '600',
    },
    messageToastBody: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
});
