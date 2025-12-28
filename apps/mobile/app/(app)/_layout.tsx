import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useAuthStore, useMatchStore } from "../../src/store";
import { colors, blur } from "../../src/theme";

function TabBarBackground() {
    if (Platform.OS === 'ios') {
        return (
            <BlurView
                intensity={blur.medium}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />
        );
    }
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass.backgroundLight }]} />;
}

export default function AppLayout() {
    const { isAuthenticated, isLoading } = useAuthStore();
    const { newMatchesCount } = useMatchStore();

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
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
                    title: "Play",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="flame" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="matches"
                options={{
                    title: "Matches",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="heart" size={size} color={color} />
                    ),
                    tabBarBadge: newMatchesCount > 0 ? newMatchesCount : undefined,
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
                }}
            />
            <Tabs.Screen
                name="chat/[id]"
                options={{
                    href: null, // Hide from tab bar
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
});
