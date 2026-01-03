import { Tabs, useRouter, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet, Platform, Text, Pressable, Animated, AppState, AppStateStatus } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore, useMatchStore, useMessageStore, useSubscriptionStore, usePacksStore } from "../../src/store";
import { useDecryptedMessage } from "../../src/hooks";
import type { KeysMetadata } from "../../src/lib/encryption";
import { colors, gradients, blur, radius, spacing, typography, shadows } from "../../src/theme";
import { supabase } from "../../src/lib/supabase";
import { isBiometricEnabled } from "../../src/lib/biometricAuth";
import { checkAndRegisterPushToken } from "../../src/lib/notifications";
import { BiometricLockScreen } from "../../src/components/BiometricLockScreen";
import { Events } from "../../src/lib/analytics";
import type { MatchWithQuestion } from "../../src/types";
import type { Database } from "../../src/types/supabase";

type Message = Database["public"]["Tables"]["messages"]["Row"];

function MessageToastPreview({
    message,
    currentUserId,
}: {
    message: Message;
    currentUserId: string;
}) {
    if (message.media_path) {
        const fallback = message.media_type === 'video' ? 'Sent a video' : 'Sent an image';
        return (
            <Text style={styles.messageToastBody} numberOfLines={1}>
                {fallback}
            </Text>
        );
    }

    const version = message.version ?? 1;
    const isV2 = version === 2;

    const { content, isDecrypting, error } = useDecryptedMessage({
        message: {
            id: message.id,
            content: message.content,
            version,
            encrypted_content: message.encrypted_content,
            encryption_iv: message.encryption_iv,
            keys_metadata: message.keys_metadata as unknown as KeysMetadata | null,
            user_id: message.user_id,
        },
        currentUserId,
    });

    if (isDecrypting) {
        return (
            <Text style={styles.messageToastBody} numberOfLines={1}>
                Waiting for message...
            </Text>
        );
    }

    if (error) {
        return (
            <Text style={styles.messageToastBody} numberOfLines={1}>
                Encrypted message
            </Text>
        );
    }

    return (
        <Text style={styles.messageToastBody} numberOfLines={1}>
            {content ?? (!isV2 ? message.content : null) ?? 'New message'}
        </Text>
    );
}

function TabBarBackground() {
    // Only use BlurView on iOS - Android experimental blur causes white overlay artifacts
    // The solid rgba background in tabBarStyle provides the visual effect on Android
    if (Platform.OS === 'ios') {
        return (
            <BlurView
                intensity={100}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />
        );
    }
    return null;
}

interface PlayTabButtonProps {
    children?: React.ReactNode;
    onPress?: (e: any) => void;
    accessibilityState?: { selected?: boolean };
    isMenuOpen?: boolean;
    onToggleMenu?: () => void;
}

interface RadialMenuItem {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    angle: number; // degrees from top (0 = top, -45 = left, 45 = right)
    variant: 'primary' | 'gold' | 'rose' | 'muted';
}

// Brand color palette for navigation
const NAV_COLORS = {
    // Primary brand colors (from logo)
    primary: colors.primary,
    primaryRgba: 'rgba(233, 69, 96, ',
    secondary: colors.secondary,
    secondaryRgba: 'rgba(155, 89, 182, ',
    // Feature-specific colors
    gold: colors.premium.gold,
    goldRgba: 'rgba(212, 175, 55, ',
    rose: colors.premium.rose,
    roseRgba: 'rgba(232, 164, 174, ',
    dark: '#0d0d1a',
};

const RADIAL_MENU_ITEMS: RadialMenuItem[] = [
    { id: 'dares', icon: 'flash', label: 'Dares', angle: -50, variant: 'gold' },
    { id: 'match', icon: 'flame', label: 'Match', angle: 0, variant: 'primary' },
    { id: 'quiz', icon: 'help-circle', label: 'Quiz', angle: 50, variant: 'rose' },
];

const RADIAL_DISTANCE = 100; // Distance from center button

// Store for sharing state between PlayTabButton and AppLayout
let globalMenuToggle: (() => void) | null = null;
let globalMenuOpen = false;

function PlayTabButton({ accessibilityState }: PlayTabButtonProps) {
    const isSelected = accessibilityState?.selected;
    const [, forceUpdate] = useState({});

    // Subscribe to global state changes
    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate({});
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <View style={styles.playButtonContainer}>
            {/* Outer glow effect - primary brand */}
            <View style={[styles.playButtonGlow, isSelected && styles.playButtonGlowActive]} />

            {/* Main circle button - premium dark with primary gradient border */}
            <Pressable onPress={() => globalMenuToggle?.()}>
                <Animated.View style={styles.playButtonCircle}>
                    <View style={styles.playButtonInner}>
                        {/* Silk highlight at top - primary gradient */}
                        <LinearGradient
                            colors={[`${NAV_COLORS.primaryRgba}0.2)`, `${NAV_COLORS.secondaryRgba}0.1)`, 'transparent']}
                            style={styles.playButtonHighlight}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        <Ionicons
                            name={globalMenuOpen ? "close" : "flame"}
                            size={28}
                            color={globalMenuOpen ? colors.textSecondary : NAV_COLORS.primary}
                        />
                    </View>
                </Animated.View>
            </Pressable>
        </View>
    );
}

export default function AppLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { isAuthenticated, isLoading, user, signOut } = useAuthStore();
    const { matches, newMatchesCount, addMatch, updateMatchUnreadCount } = useMatchStore();
    const { unreadCount, lastMessage, fetchUnreadCount, addMessage, clearLastMessage } = useMessageStore();
    const { fetchEnabledPacks } = usePacksStore();
    const { initializeRevenueCat } = useSubscriptionStore();
    const [matchNotification, setMatchNotification] = useState<MatchWithQuestion | null>(null);
    const matchModalAnim = useRef(new Animated.Value(0)).current;
    const messageToastAnim = useRef(new Animated.Value(-100)).current;
    const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const hasCheckedInitialBiometric = useRef(false);
    const wentToBackgroundAt = useRef<number | null>(null);

    // Radial menu state
    const [isRadialMenuOpen, setIsRadialMenuOpen] = useState(false);
    const radialMenuAnim = useRef(new Animated.Value(0)).current;

    const toggleRadialMenu = useCallback(() => {
        const toValue = isRadialMenuOpen ? 0 : 1;
        setIsRadialMenuOpen(!isRadialMenuOpen);
        globalMenuOpen = !isRadialMenuOpen;

        Animated.spring(radialMenuAnim, {
            toValue,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
        }).start();
    }, [isRadialMenuOpen, radialMenuAnim]);

    const closeRadialMenu = useCallback(() => {
        setIsRadialMenuOpen(false);
        globalMenuOpen = false;
        Animated.timing(radialMenuAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [radialMenuAnim]);

    const handleRadialMenuItemPress = useCallback((itemId: string) => {
        closeRadialMenu();

        // Navigate based on item
        switch (itemId) {
            case 'match':
                router.push('/(app)/swipe');
                break;
            case 'dares':
                router.push('/(app)/dares');
                break;
            case 'quiz':
                router.push('/(app)/quiz');
                break;
        }
    }, [router, closeRadialMenu]);

    // Register global menu toggle for PlayTabButton
    useEffect(() => {
        globalMenuToggle = toggleRadialMenu;
        return () => {
            globalMenuToggle = null;
        };
    }, [toggleRadialMenu]);

    // Check if we're on screens that should hide the tab bar
    const segmentStrings = segments as string[];
    const isOnOnboarding = segmentStrings.includes("onboarding");
    const isOnPairing = segmentStrings.includes("pairing");
    const isOnChat = segmentStrings.includes("chat");
    const shouldHideTabBar = isOnOnboarding || isOnPairing || isOnChat;

    // Redirect to login when not authenticated, or to onboarding if not completed
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace("/(auth)/login");
        } else if (!isLoading && isAuthenticated && user && !user.onboarding_completed && !isOnOnboarding) {
            router.replace("/(app)/onboarding");
        }
    }, [isLoading, isAuthenticated, user, router, isOnOnboarding]);

    // Check session validity on mount and when app comes to foreground
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // No valid session - sign out to clear local state
                signOut();
            }
        };

        // Check immediately
        checkSession();

        // Check when app comes to foreground
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkSession();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [signOut]);

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

    // Initialize RevenueCat for subscription management
    useEffect(() => {
        if (user?.id && Platform.OS === "ios") {
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

    // Subscribe to realtime changes on the current user's profile
    // This detects when partner disconnects (sets our couple_id to NULL)
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`profile:${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `id=eq.${user.id}`,
                },
                async (payload) => {
                    const newProfile = payload.new as { couple_id: string | null };
                    // If couple_id changed (especially to NULL when partner disconnects)
                    if (newProfile.couple_id !== user.couple_id) {
                        console.log("Profile couple_id changed, refreshing user data...");
                        await useAuthStore.getState().fetchUser();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, user?.couple_id]);

    // Subscribe to realtime match notifications
    useEffect(() => {
        if (!user?.couple_id) return;

        const channel = supabase
            .channel(`matches:${user.couple_id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "matches",
                    filter: `couple_id=eq.${user.couple_id}`,
                },
                async (payload) => {
                    // Fetch the full match with question details
                    const { data: matchWithQuestion } = await supabase
                        .from("matches")
                        .select(`
                            *,
                            question:questions(*)
                        `)
                        .eq("id", payload.new.id)
                        .single();

                    if (matchWithQuestion) {
                        // Track milestone events before adding (so count is accurate)
                        const currentMatchCount = matches.length;
                        if (currentMatchCount === 0) {
                            Events.firstMatch();
                        } else if ((currentMatchCount + 1) % 10 === 0) {
                            Events.milestoneMatch(currentMatchCount + 1);
                        }

                        // Add to store and show notification
                        addMatch(matchWithQuestion);
                        setMatchNotification(matchWithQuestion);
                        Events.matchCreated(matchWithQuestion.match_type || "unknown");
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.couple_id, addMatch, matches.length]);

    // Subscribe to realtime message notifications
    useEffect(() => {
        if (!user?.couple_id) return;

        const channel = supabase
            .channel(`messages:${user.couple_id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                },
                async (payload) => {
                    const newMessage = payload.new as Message;

                    // Only process messages from partner
                    if (newMessage.user_id === user.id) return;

                    // Mark as delivered (message received by device)
                    if (!newMessage.delivered_at) {
                        await supabase
                            .from("messages")
                            .update({ delivered_at: new Date().toISOString() })
                            .eq("id", newMessage.id);
                    }

                    // Fetch the match details for context
                    const { data: match } = await supabase
                        .from("matches")
                        .select("id, question:questions(text)")
                        .eq("id", newMessage.match_id)
                        .single();

                    if (match) {
                        // Handle the joined question data from the query
                        const questionData = match.question;
                        const questionText = Array.isArray(questionData)
                            ? questionData[0]?.text
                            : (questionData as { text: string } | null)?.text;

                        addMessage({
                            ...newMessage,
                            delivered_at: newMessage.delivered_at || new Date().toISOString(),
                            match: { id: match.id, question: { text: questionText || "" } },
                        });

                        // Sync per-match unread count for realtime updates
                        updateMatchUnreadCount(match.id, 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.couple_id, user?.id, addMessage]);

    // Subscribe to realtime pack setting changes (when partner toggles a pack)
    useEffect(() => {
        if (!user?.couple_id) return;

        const channel = supabase
            .channel(`couple_packs:${user.couple_id}`)
            .on(
                "postgres_changes",
                {
                    event: "*", // INSERT, UPDATE, DELETE
                    schema: "public",
                    table: "couple_packs",
                    filter: `couple_id=eq.${user.couple_id}`,
                },
                () => {
                    // Refetch enabled packs when partner changes pack settings
                    fetchEnabledPacks();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.couple_id, fetchEnabledPacks]);

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

    // Animate match modal when notification changes
    useEffect(() => {
        if (matchNotification) {
            Animated.spring(matchModalAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        }
    }, [matchNotification, matchModalAnim]);

    const dismissNotification = useCallback(() => {
        Animated.timing(matchModalAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setMatchNotification(null);
        });
    }, [matchModalAnim]);

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
    if (isLoading || !isAuthenticated || (user && !user.onboarding_completed && !isOnOnboarding)) {
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
                        backgroundColor: 'rgba(13, 13, 26, 0.92)',
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
                    name="packs"
                    options={{
                        title: "Packs",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="layers" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="swipe"
                    options={{
                        title: "",
                        tabBarButton: (props) => <PlayTabButton {...props} />,
                    }}
                />
                <Tabs.Screen
                    name="matches"
                    options={{
                        title: "Matches",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="heart" size={size} color={color} />
                        ),
                        tabBarBadge: (newMatchesCount + unreadCount) > 0 ? (newMatchesCount + unreadCount) : undefined,
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
            </Tabs>

            {/* Radial Menu Overlay */}
            {isRadialMenuOpen && (
                <Pressable
                    style={radialStyles.overlay}
                    onPress={closeRadialMenu}
                />
            )}

            {/* Radial Menu Items - positioned above the center button */}
            <Animated.View
                style={[
                    radialStyles.menuContainer,
                    { opacity: radialMenuAnim },
                ]}
                pointerEvents={isRadialMenuOpen ? 'auto' : 'none'}
            >
                {RADIAL_MENU_ITEMS.map((item) => {
                    // Convert angle to radians and calculate position
                    const angleRad = (item.angle - 90) * (Math.PI / 180); // -90 to make 0 = top
                    const translateX = Math.cos(angleRad) * RADIAL_DISTANCE;
                    const translateY = Math.sin(angleRad) * RADIAL_DISTANCE;

                    const itemScale = radialMenuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                    });

                    const itemTranslateX = radialMenuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, translateX],
                    });

                    const itemTranslateY = radialMenuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, translateY],
                    });

                    // Brand and feature variant colors
                    const getVariantStyles = () => {
                        switch (item.variant) {
                            case 'primary':
                                return {
                                    bg: `${NAV_COLORS.primaryRgba}0.15)`,
                                    border: `${NAV_COLORS.primaryRgba}0.35)`,
                                    icon: NAV_COLORS.primary,
                                    label: NAV_COLORS.primary,
                                };
                            case 'gold':
                                return {
                                    bg: `${NAV_COLORS.goldRgba}0.15)`,
                                    border: `${NAV_COLORS.goldRgba}0.35)`,
                                    icon: NAV_COLORS.gold,
                                    label: NAV_COLORS.gold,
                                };
                            case 'rose':
                                return {
                                    bg: `${NAV_COLORS.roseRgba}0.15)`,
                                    border: `${NAV_COLORS.roseRgba}0.35)`,
                                    icon: NAV_COLORS.rose,
                                    label: NAV_COLORS.rose,
                                };
                            case 'muted':
                            default:
                                return {
                                    bg: 'rgba(255, 255, 255, 0.08)',
                                    border: 'rgba(255, 255, 255, 0.15)',
                                    icon: colors.textSecondary,
                                    label: colors.textSecondary,
                                };
                        }
                    };

                    const variantStyles = getVariantStyles();

                    return (
                        <Animated.View
                            key={item.id}
                            style={[
                                radialStyles.menuItem,
                                {
                                    transform: [
                                        { translateX: itemTranslateX },
                                        { translateY: itemTranslateY },
                                        { scale: itemScale },
                                    ],
                                },
                            ]}
                        >
                            <Pressable
                                onPress={() => handleRadialMenuItemPress(item.id)}
                                style={radialStyles.menuItemButton}
                            >
                                <View style={[
                                    radialStyles.menuItemCircle,
                                    {
                                        backgroundColor: variantStyles.bg,
                                        borderColor: variantStyles.border,
                                    },
                                ]}>
                                    <Ionicons
                                        name={item.icon}
                                        size={22}
                                        color={variantStyles.icon}
                                    />
                                </View>
                                <Text style={[radialStyles.menuItemLabel, { color: variantStyles.label }]}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    );
                })}
            </Animated.View>

            {/* Match Notification Overlay - Using Animated.View instead of Modal for Android compatibility */}
            {matchNotification && (
                <Animated.View
                    style={[
                        styles.matchOverlay,
                        {
                            opacity: matchModalAnim,
                        },
                    ]}
                >
                    <Pressable style={styles.matchOverlayBackground} onPress={dismissNotification} />
                    <Animated.View
                        style={[
                            styles.modalContent,
                            {
                                transform: [
                                    {
                                        scale: matchModalAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.8, 1],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.modalHeader}>
                            <Ionicons name="heart" size={48} color={colors.primary} />
                            <Text style={styles.modalTitle}>It's a Match!</Text>
                        </View>
                        <Text style={styles.modalSubtitle}>You both agreed on:</Text>
                        <Text style={styles.modalQuestion}>
                            "{matchNotification?.question?.text}"
                        </Text>
                        <View style={styles.matchTypeBadge}>
                            <Text style={styles.matchTypeText}>
                                {matchNotification?.match_type === 'yes_yes' ? 'YES + YES' :
                                    matchNotification?.match_type === 'yes_maybe' ? 'YES + MAYBE' :
                                        'MAYBE + MAYBE'}
                            </Text>
                        </View>
                        <Pressable style={styles.dismissButton} onPress={dismissNotification}>
                            <Text style={styles.dismissButtonText}>Nice!</Text>
                        </Pressable>
                    </Animated.View>
                </Animated.View>
            )}

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
                            <MessageToastPreview message={lastMessage} currentUserId={user?.id ?? ''} />
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
    matchOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    matchOverlayBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContent: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        width: '90%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: colors.glass.border,
        ...shadows.lg,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        ...typography.title1,
        color: colors.text,
        marginTop: spacing.md,
    },
    modalSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    modalQuestion: {
        ...typography.headline,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    matchTypeBadge: {
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        marginBottom: spacing.lg,
    },
    matchTypeText: {
        ...typography.caption1,
        color: colors.primary,
        fontWeight: '600',
    },
    dismissButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        minWidth: 120,
    },
    dismissButtonText: {
        ...typography.headline,
        color: colors.text,
        textAlign: 'center',
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
    // Play button styles - Premium boutique
    playButtonContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -28,
    },
    playButtonGlow: {
        position: 'absolute',
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: colors.primaryGlow,
        opacity: 0.4,
    },
    playButtonGlowActive: {
        opacity: 0.7,
        ...shadows.glow(colors.primary),
    },
    playButtonCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(233, 69, 96, 0.4)', // primary brand
        ...shadows.lg,
    },
    playButtonInner: {
        flex: 1,
        backgroundColor: '#0d0d1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
    },
    playButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

// Radial menu styles - Premium boutique
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 64;

const radialStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(13, 13, 26, 0.85)',
        zIndex: 998,
    },
    menuContainer: {
        position: 'absolute',
        bottom: TAB_BAR_HEIGHT + 30, // Position above tab bar, centered on button
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 999,
    },
    menuItem: {
        position: 'absolute',
        alignItems: 'center',
    },
    menuItemButton: {
        alignItems: 'center',
    },
    menuItemCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(22, 33, 62, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    menuItemLabel: {
        ...typography.caption2,
        color: colors.text,
        marginTop: 8,
        fontWeight: '500',
        letterSpacing: 1,
        textTransform: 'uppercase',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
