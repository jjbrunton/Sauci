import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, useMatchStore, useMessageStore, usePacksStore } from '../../../store';
import { accountOperationsApi } from '../../../lib/accountOperationsApi';
import { coupleApi } from '../../../lib/coupleApi';
import { Events } from '../../../lib/analytics';

export function useCoupleManagement() {
    const router = useRouter();
    const { fetchCouple, fetchUser, signOut } = useAuthStore();
    const { clearMatches } = useMatchStore();
    const { clearMessages } = useMessageStore();
    const { clearPacks } = usePacksStore();

    const [isResettingProgress] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const handleUnpair = async () => {
        Alert.alert(
            "Unpair Partner",
            "Are you sure you want to unpair? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unpair",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await coupleApi.cancel();
                            await fetchCouple();
                            // Refresh user to update UI state
                            await fetchUser();
                        } catch {
                            Alert.alert("Error", "Failed to unpair");
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteRelationship = async () => {
        try {
            await accountOperationsApi.deleteRelationship();

            // Clear local stores
            clearMatches();
            clearMessages();
            clearPacks();

            // Refresh user data
            await fetchUser();

            Events.relationshipEnded();
            Alert.alert("Success", "All relationship data has been deleted.");
        } catch (error) {
            console.error("Delete relationship error:", error);
            Alert.alert("Error", "Failed to delete relationship data. Please try again.");
            throw error;
        }
    };

    const handleResetProgress = async () => {
        try {
            await accountOperationsApi.resetProgress();

            // Clear local stores
            clearMatches();
            clearMessages();

            Alert.alert("Success", "Your progress has been reset. You can now start swiping again!");
        } catch (error) {
            Alert.alert("Error", "Failed to reset progress. Please try again.");
            throw error;
        }
    };

    const handleSignOut = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: signOut,
                },
            ]
        );
    };

    const handleDeleteAccount = async () => {
        setIsDeletingAccount(true);
        try {
            await accountOperationsApi.deleteAccount();

            // Clear all local data
            clearMatches();
            clearMessages();
            clearPacks();

            Events.accountDeleted();

            // Sign out the user (this will redirect to login)
            await signOut();
        } catch (error) {
            console.error("Delete account error:", error);
            Alert.alert("Error", "Failed to delete account. Please try again.");
            throw error;
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const navigateToPairing = () => {
        router.push("/(app)/pairing");
    };

    return {
        isResettingProgress,
        isDeletingAccount,
        handleUnpair,
        handleDeleteRelationship,
        handleResetProgress,
        handleSignOut,
        handleDeleteAccount,
        navigateToPairing,
    };
}
