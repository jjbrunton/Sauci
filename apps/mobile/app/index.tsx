import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { needsOnboarding } from "../src/constants/onboarding";

export default function Index() {
    const { isAuthenticated, isLoading, user } = useAuthStore();

    // Show loading state while auth is being determined
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

    // If user hasn't completed onboarding or needs to re-onboard, go to onboarding
    if (needsOnboarding(user?.onboarding_completed, user?.onboarding_version)) {
        return <Redirect href="/(app)/onboarding" />;
    }

    // Go to home/dashboard - users can pair from within the app
    // No forced redirect to pairing for users without a couple
    return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1a1a2e",
    },
});
