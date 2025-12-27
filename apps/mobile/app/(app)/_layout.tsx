import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuthStore, useMatchStore } from "../../src/store";

export default function AppLayout() {
    const { isAuthenticated, isLoading } = useAuthStore();
    const { newMatchesCount } = useMatchStore();

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e94560" />
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
                tabBarStyle: {
                    backgroundColor: "#16213e",
                    borderTopColor: "#0f3460",
                    borderTopWidth: 1,
                    paddingTop: 8,
                    paddingBottom: 8,
                    height: 60,
                },
                tabBarActiveTintColor: "#e94560",
                tabBarInactiveTintColor: "#666",
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "500",
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
                        backgroundColor: "#e94560",
                        fontSize: 10,
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
        backgroundColor: "#1a1a2e",
    },
});
