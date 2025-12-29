import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Share,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "../../src/store";
import { supabase } from "../../src/lib/supabase";
import { router } from "expo-router";

export default function PairingScreen() {
    const { user, fetchCouple, fetchUser, couple, partner, isLoading: isAuthLoading, signOut } = useAuthStore();
    const [inviteCode, setInviteCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirect if already paired
    useEffect(() => {
        if (couple && partner) {
            router.replace("/(app)/");
        }
    }, [couple, partner]);

    // Subscribe to real-time updates for partner joining + polling fallback
    useEffect(() => {
        if (!couple || partner) return;

        // Poll every 5 seconds as fallback
        const pollInterval = setInterval(() => {
            fetchCouple();
        }, 5000);

        // Listen for new profiles joining this couple
        const subscription = supabase
            .channel(`couple-${couple.id}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `couple_id=eq.${couple.id}`,
                },
                async (payload) => {
                    // Someone updated their profile to join this couple
                    if (payload.new.id !== user?.id) {
                        await fetchCouple();
                    }
                }
            )
            .subscribe();

        return () => {
            clearInterval(pollInterval);
            subscription.unsubscribe();
        };
    }, [couple, partner, user?.id, fetchCouple]);

    const handleCreateCouple = async () => {
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.functions.invoke("manage-couple", {
                method: "POST",
                body: {},
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            await fetchUser(); // Refresh user to get couple_id
            await fetchCouple(); // Fetch couple data
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJoinCouple = async () => {
        if (inviteCode.length < 8) {
            Alert.alert("Error", "Please enter a valid invite code");
            return;
        }

        setIsSubmitting(true);
        try {
            // Refresh session to ensure we have a valid token
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error("Please log in again");
            }

            const { data, error } = await supabase.functions.invoke("manage-couple", {
                method: "POST",
                body: { invite_code: inviteCode },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            await fetchUser(); // Refresh user to get couple_id
            await fetchCouple(); // Fetch couple data

            Alert.alert("Success", "You are now paired! 💕", [
                { text: "Let's Go", onPress: () => router.replace("/(app)/") }
            ]);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = async () => {
        if (couple?.invite_code) {
            await Clipboard.setStringAsync(couple.invite_code);
            Alert.alert("Copied", "Invite code copied to clipboard");
        }
    };

    const shareCode = async () => {
        if (couple?.invite_code) {
            try {
                await Share.share({
                    message: `Join me on Sauci! Use my invite code to pair up: ${couple.invite_code}`,
                });
            } catch (error) {
                console.error(error);
            }
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

    if (isAuthLoading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    // If user has a couple but no partner, they are waiting
    if (couple && !partner) {
        return (
            <View style={styles.container}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="heart" size={48} color="#e94560" />
                    </View>
                    <Text style={styles.title}>Partner Code</Text>
                    <Text style={styles.subtitle}>
                        Share this code with your partner to link your accounts
                    </Text>

                    <TouchableOpacity style={styles.codeContainer} onPress={copyToClipboard}>
                        <Text style={styles.code}>{couple.invite_code.toUpperCase()}</Text>
                        <Ionicons name="copy-outline" size={24} color="#666" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.shareButton} onPress={shareCode}>
                        <Ionicons name="share-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Share Code</Text>
                    </TouchableOpacity>

                    <Text style={styles.waitingText}>
                        Waiting for your partner to join...
                    </Text>
                    <ActivityIndicator size="small" color="#e94560" style={{ marginTop: 16 }} />
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
            >
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.content}>
                <Text style={styles.emoji}>🔗</Text>
                <Text style={styles.title}>Pair Up</Text>
                <Text style={styles.subtitle}>
                    Link with your partner to start matching
                </Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Have a code?</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter invite code"
                        placeholderTextColor="#666"
                        value={inviteCode}
                        onChangeText={setInviteCode}
                        autoCapitalize="characters"
                        maxLength={8}
                    />
                    <TouchableOpacity
                        style={[styles.button, isSubmitting && styles.buttonDisabled]}
                        onPress={handleJoinCouple}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.buttonText}>
                            {isSubmitting ? "Joining..." : "Join Partner"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleCreateCouple}
                    disabled={isSubmitting}
                >
                    <Text style={styles.secondaryButtonText}>
                        {isSubmitting ? "Creating..." : "Create New Code"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={20} color="#888" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a2e",
    },
    backButton: {
        position: "absolute",
        top: Platform.OS === "ios" ? 60 : 40,
        left: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    centerContent: {
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: "#888",
        marginBottom: 48,
        textAlign: "center",
    },
    card: {
        width: "100%",
        backgroundColor: "#16213e",
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
        marginBottom: 16,
    },
    input: {
        backgroundColor: "#1a1a2e",
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        color: "#fff",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#0f3460",
        textAlign: "center",
        letterSpacing: 2,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    button: {
        backgroundColor: "#e94560",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 32,
        width: "100%",
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#333",
    },
    dividerText: {
        color: "#666",
        paddingHorizontal: 16,
    },
    secondaryButton: {
        padding: 16,
    },
    secondaryButtonText: {
        color: "#e94560",
        fontSize: 16,
        fontWeight: "600",
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(233, 69, 96, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },
    codeContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16213e",
        padding: 20,
        borderRadius: 16,
        marginTop: 32,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "#e94560",
        borderStyle: "dashed",
    },
    code: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#fff",
        letterSpacing: 4,
        marginRight: 16,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    shareButton: {
        flexDirection: "row",
        backgroundColor: "#e94560",
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    waitingText: {
        marginTop: 48,
        color: "#666",
        fontSize: 14,
    },
    signOutButton: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 48,
        padding: 12,
    },
    signOutText: {
        color: "#888",
        fontSize: 16,
        marginLeft: 8,
    },
});
