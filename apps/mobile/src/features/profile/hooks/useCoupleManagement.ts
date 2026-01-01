import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, useMatchStore, useMessageStore, usePacksStore } from '../../../store';
import { supabase } from '../../../lib/supabase';
import { Events } from '../../../lib/analytics';

export function useCoupleManagement() {
    const router = useRouter();
    const { fetchCouple, fetchUser, signOut } = useAuthStore();
    const { clearMatches } = useMatchStore();
    const { clearMessages } = useMessageStore();
    const { clearPacks } = usePacksStore();

    const [isResettingProgress, setIsResettingProgress] = useState(false);

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
                            await supabase.functions.invoke("manage-couple", {
                                method: "DELETE",
                            });
                            await fetchCouple();
                            // Refresh user to update UI state
                            await fetchUser();
                        } catch (error) {
                            Alert.alert("Error", "Failed to unpair");
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteRelationship = async () => {
        try {
            const { error } = await supabase.functions.invoke("delete-relationship", {
                method: "DELETE",
            });

            if (error) throw error;

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
        Alert.alert(
            "Reset Progress",
            "This will delete all your swipes, matches, and chat messages. You'll stay connected with your partner and can start fresh. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        setIsResettingProgress(true);
                        try {
                            const { error } = await supabase.functions.invoke("reset-couple-progress", {
                                method: "DELETE",
                            });

                            if (error) throw error;

                            // Clear local stores
                            clearMatches();
                            clearMessages();

                            Alert.alert("Success", "Your progress has been reset. You can now start swiping again!");
                        } catch (error) {
                            Alert.alert("Error", "Failed to reset progress. Please try again.");
                        } finally {
                            setIsResettingProgress(false);
                        }
                    },
                },
            ]
        );
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

    const navigateToPairing = () => {
        router.push("/(app)/pairing");
    };

    return {
        isResettingProgress,
        handleUnpair,
        handleDeleteRelationship,
        handleResetProgress,
        handleSignOut,
        navigateToPairing,
    };
}
