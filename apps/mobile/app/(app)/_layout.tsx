import { Tabs, useRouter, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet, Platform, Modal, Text, Pressable, Animated, AppState } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore, useMatchStore, useMessageStore, useSubscriptionStore, usePacksStore } from "../../src/store";
import { colors, gradients, blur, radius, spacing, typography, shadows } from "../../src/theme";
import { supabase } from "../../src/lib/supabase";
import type { MatchWithQuestion } from "../../src/types";
import type { Database } from "../../src/types/supabase";

type Message = Database["public"]["Tables"]["messages"]["Row"];

function TabBarBackground() {
    if (Platform.OS === 'ios') {
        return (
            <BlurView
                intensity={blur.heavy}
                tint="systemChromeMaterialDark"
                style={StyleSheet.absoluteFill}
            />
        );
    }
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(22, 33, 62, 0.9)' }]} />;
}

interface PlayTabButtonProps {
    children?: React.ReactNode;
    onPress?: (e: any) => void;
    accessibilityState?: { selected?: boolean };
}

function PlayTabButton({ onPress, accessibilityState }: PlayTabButtonProps) {
    const isSelected = accessibilityState?.selected;

    return (
        <Pressable
            onPress={onPress}
            style={styles.playButtonContainer}
        >
            {/* Outer glow effect */}
            <View style={[styles.playButtonGlow, isSelected && styles.playButtonGlowActive]} />

            {/* Circle container */}
            <View style={styles.playButtonCircle}>
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.playButtonGradient}
                >
                    <Ionicons
                        name="flame"
                        size={32}
                        color={colors.text}
                    />
                </LinearGradient>
            </View>
        </Pressable>
    );
}

export default function AppLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { isAuthenticated, isLoading, user, signOut } = useAuthStore();
    const { newMatchesCount, addMatch } = useMatchStore();
    const { unreadCount, lastMessage, fetchUnreadCount, addMessage, clearLastMessage } = useMessageStore();
    const { fetchEnabledPacks } = usePacksStore();
    const { initializeRevenueCat } = useSubscriptionStore();
    const [matchNotification, setMatchNotification] = useState<MatchWithQuestion | null>(null);
    const messageToastAnim = useRef(new Animated.Value(-100)).current;
    const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check if we're currently on the onboarding screen
    const isOnOnboarding = segments.includes("onboarding");

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
                        // Add to store and show notification
                        addMatch(matchWithQuestion);
                        setMatchNotification(matchWithQuestion);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.couple_id, addMatch]);

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
                        addMessage({
                            ...newMessage,
                            delivered_at: newMessage.delivered_at || new Date().toISOString(),
                            match: match as { id: string; question: { text: string } },
                        });
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

    const dismissNotification = useCallback(() => {
        setMatchNotification(null);
    }, []);

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
                    tabBarStyle: {
                        position: 'absolute',
                        backgroundColor: 'transparent',
                        borderTopColor: colors.glass.border,
                        borderTopWidth: 1,
                        paddingTop: 8,
                        paddingBottom: Platform.OS === 'ios' ? 28 : 8,
                        height: Platform.OS === 'ios' ? 88 : 64,
                        elevation: 0,
                    },
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textTertiary,
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: "600",
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
                            backgroundColor: colors.primary,
                            fontSize: 10,
                            fontWeight: '600',
                        },
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: "Profile",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="person" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="pairing"
                    options={{
                        href: null, // Hide from tab bar
                        tabBarStyle: { display: 'none' }, // Hide tab bar on pairing screen
                    }}
                />
                <Tabs.Screen
                    name="chat/[id]"
                    options={{
                        href: null, // Hide from tab bar
                        tabBarStyle: { display: 'none' }, // Hide tab bar on chat screen
                    }}
                />
                <Tabs.Screen
                    name="onboarding"
                    options={{
                        href: null, // Hide from tab bar
                        tabBarStyle: { display: 'none' }, // Hide tab bar on onboarding screen
                    }}
                />
            </Tabs>

            {/* Match Notification Modal */}
            <Modal
                visible={!!matchNotification}
                transparent
                animationType="fade"
                onRequestClose={dismissNotification}
            >
                <Pressable style={styles.modalOverlay} onPress={dismissNotification}>
                    <View style={styles.modalContent}>
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
                    </View>
                </Pressable>
            </Modal>

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
                            <Text style={styles.messageToastBody} numberOfLines={1}>
                                {lastMessage.content || "Sent an image"}
                            </Text>
                        </View>
                        <Pressable onPress={dismissMessageToast} hitSlop={8}>
                            <Ionicons name="close" size={20} color={colors.textTertiary} />
                        </Pressable>
                    </Pressable>
                </Animated.View>
            )}
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        width: '100%',
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
    // Play button styles
    playButtonContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -28,
    },
    playButtonGlow: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.primaryGlow,
        opacity: 0.5,
    },
    playButtonGlowActive: {
        opacity: 1,
        ...shadows.glow(colors.primary),
    },
    playButtonCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        ...shadows.lg,
    },
    playButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
