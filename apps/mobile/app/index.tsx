import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { needsOnboarding } from "../src/constants/onboarding";
import { getPendingInviteCode } from "../src/lib/pendingInviteCode";

export default function Index() {
    const { isAuthenticated, isLoading, user } = useAuthStore();
    const [pendingCodeChecked, setPendingCodeChecked] = useState(false);
    const [hasPendingInvite, setHasPendingInvite] = useState(false);

    // Check once, after auth resolves, whether an invite code is waiting to be
    // applied (e.g. the user tapped a join link before signing in).
    useEffect(() => {
        if (isLoading || !isAuthenticated || user?.couple_id) {
            return;
        }

        let cancelled = false;
        getPendingInviteCode().then((code) => {
            if (cancelled) return;
            setHasPendingInvite(!!code);
            setPendingCodeChecked(true);
        });

        return () => {
            cancelled = true;
        };
    }, [isLoading, isAuthenticated, user?.couple_id]);

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

    // A couple already exists for this user; no invite hand-off is relevant.
    if (user?.couple_id) {
        return <Redirect href="/(app)" />;
    }

    // Wait for the one-time pending invite code check before deciding the
    // route, so a stashed code from a join link is applied without an extra
    // trip through the home screen.
    if (!pendingCodeChecked) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    if (hasPendingInvite) {
        return <Redirect href="/(app)/pairing" />;
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
