import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from "react-native";
import { useAuthStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";

export default function ProfileScreen() {
    const { user, partner, signOut, fetchCouple } = useAuthStore();

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
                            await fetchCouple(); // Refresh state
                        } catch (error) {
                            Alert.alert("Error", "Failed to unpair");
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Profile</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.name?.[0]?.toUpperCase() || "U"}
                        </Text>
                    </View>
                    <Text style={styles.name}>{user?.name || "User"}</Text>
                    <Text style={styles.email}>{user?.email}</Text>
                </View>

                <Text style={styles.sectionTitle}>Relationship</Text>
                <View style={styles.section}>
                    {partner ? (
                        <View style={styles.row}>
                            <View style={styles.partnerInfo}>
                                <Ionicons name="heart" size={24} color="#e94560" />
                                <Text style={styles.rowText}>Paired with {partner.name || partner.email || 'your partner'}</Text>
                            </View>
                            <TouchableOpacity onPress={handleUnpair}>
                                <Ionicons name="trash-outline" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.row}>
                            <Text style={styles.rowText}>Not paired yet</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.sectionTitle}>Settings</Text>
                <View style={styles.section}>
                    <TouchableOpacity style={styles.row} onPress={signOut}>
                        <Text style={[styles.rowText, { color: "#ff4444" }]}>Sign Out</Text>
                        <Ionicons name="log-out-outline" size={20} color="#ff4444" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.version}>Sauci v1.0.0</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a2e",
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#16213e",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#fff",
    },
    content: {
        padding: 24,
    },
    profileCard: {
        alignItems: "center",
        marginBottom: 40,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#e94560",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#fff",
    },
    name: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
        color: "#666",
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#666",
        marginBottom: 8,
        marginLeft: 4,
        textTransform: "uppercase",
    },
    section: {
        backgroundColor: "#16213e",
        borderRadius: 12,
        marginBottom: 24,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#1a1a2e",
    },
    partnerInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    rowText: {
        fontSize: 16,
        color: "#fff",
    },
    version: {
        textAlign: "center",
        color: "#666",
        fontSize: 12,
        marginTop: 24,
    },
});
