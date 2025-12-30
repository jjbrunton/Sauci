import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
    const { isAuthenticated, isLoading, user } = useAuthStore();

    // Show loading state
    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    // Redirect based on auth state
    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    // If user hasn't completed onboarding, go to onboarding first
    if (!user?.onboarding_completed) {
        return <Redirect href="/(app)/onboarding" />;
    }

    // If user has no couple, go to pairing
    if (!user?.couple_id) {
        return <Redirect href="/(app)/pairing" />;
    }

    // Otherwise go to home
    return <Redirect href="/(app)/" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1a1a2e",
    },
});
