import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useMatchStore, useAuthStore } from "../../src/store";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function MatchesScreen() {
    const { matches, fetchMatches, markAllAsSeen } = useMatchStore();
    const { user } = useAuthStore();

    useEffect(() => {
        fetchMatches();
    }, []);

    // Mark all matches as seen when matches are loaded
    useEffect(() => {
        if (matches.length > 0) {
            markAllAsSeen();
        }
    }, [matches.length]);

    const router = useRouter();

    const renderItem = ({ item }: { item: any }) => {
        const userResponse = item.responses?.find((r: any) => r.user_id === user?.id);
        const partnerResponse = item.responses?.find((r: any) => r.user_id !== user?.id);

        let userText = item.question.text;
        let partnerText = item.question.partner_text;

        if (item.question.partner_text && userResponse && partnerResponse) {
            const userTime = new Date(userResponse.created_at).getTime();
            const partnerTime = new Date(partnerResponse.created_at).getTime();

            // If user answered after partner, they saw the partner_text
            if (userTime > partnerTime) {
                userText = item.question.partner_text;
                partnerText = item.question.text;
            }
        }

        return (
            <TouchableOpacity
                style={styles.matchCard}
                onPress={() => router.push(`/chat/${item.id}`)}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="sparkles" size={24} color="#e94560" />
                </View>
                <View style={styles.content}>
                    <Text style={styles.questionText}>{userText}</Text>
                    {item.question.partner_text && (
                        <Text style={styles.partnerText}>Partner: {partnerText}</Text>
                    )}
                    <View style={styles.tagContainer}>
                        <View style={styles.tag}>
                            <Text style={styles.tagText}>
                                {item.match_type === "yes_yes" ? "Review: YES + YES" : "Review: YES + MAYBE"}
                            </Text>
                        </View>
                        <Text style={styles.date}>
                            {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#e94560" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Your Matches</Text>
            </View>

            <FlatList
                data={matches}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={false} onRefresh={fetchMatches} tintColor="#e94560" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No matches yet. Keep swiping!</Text>
                    </View>
                }
            />
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
    list: {
        padding: 24,
    },
    matchCard: {
        flexDirection: "row",
        backgroundColor: "#16213e",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(233, 69, 96, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    questionText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
        marginBottom: 8,
        lineHeight: 22,
    },
    tagContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    tag: {
        backgroundColor: "rgba(233, 69, 96, 0.2)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    tagText: {
        color: "#e94560",
        fontSize: 12,
        fontWeight: "bold",
    },
    date: {
        color: "#666",
        fontSize: 12,
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },
    emptyText: {
        color: "#666",
        fontSize: 16,
    },
    partnerText: {
        fontSize: 14,
        color: "#aaa",
        fontStyle: "italic",
        marginBottom: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
