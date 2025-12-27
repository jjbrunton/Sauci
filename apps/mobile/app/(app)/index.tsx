import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useAuthStore, useMatchStore, usePacksStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function HomeScreen() {
    const { user, partner } = useAuthStore();
    const { matches, newMatchesCount, fetchMatches } = useMatchStore();
    const { packs, fetchPacks } = usePacksStore();

    useEffect(() => {
        fetchMatches();
        fetchPacks();
    }, []);

    const recentMatches = matches.slice(0, 3);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.greeting}>
                    Hey, {user?.name || "there"} 👋
                </Text>
                {partner && (
                    <Text style={styles.partnerText}>
                        Paired with {partner.name || partner.email || 'your partner'}
                    </Text>
                )}
            </View>

            {/* Quick Stats */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Ionicons name="heart" size={24} color="#e94560" />
                    <Text style={styles.statNumber}>{matches.length}</Text>
                    <Text style={styles.statLabel}>Matches</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="layers" size={24} color="#e94560" />
                    <Text style={styles.statNumber}>{packs.length}</Text>
                    <Text style={styles.statLabel}>Packs</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="sparkles" size={24} color="#e94560" />
                    <Text style={styles.statNumber}>{newMatchesCount}</Text>
                    <Text style={styles.statLabel}>New</Text>
                </View>
            </View>

            {/* Start Playing CTA */}
            <TouchableOpacity
                style={styles.ctaCard}
                onPress={() => router.push("/(app)/swipe")}
            >
                <View style={styles.ctaContent}>
                    <Text style={styles.ctaTitle}>Ready to explore?</Text>
                    <Text style={styles.ctaSubtitle}>
                        Swipe through questions and discover what you both enjoy
                    </Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Recent Matches */}
            {recentMatches.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Matches</Text>
                        <TouchableOpacity onPress={() => router.push("/(app)/matches")}>
                            <Text style={styles.seeAll}>See all</Text>
                        </TouchableOpacity>
                    </View>
                    {recentMatches.map((match) => (
                        <View key={match.id} style={styles.matchItem}>
                            <View style={styles.matchIcon}>
                                <Ionicons name="heart" size={20} color="#e94560" />
                            </View>
                            <Text style={styles.matchText} numberOfLines={1}>
                                {(match as any).question?.text || "A new match!"}
                            </Text>
                            {match.is_new && <View style={styles.newBadge} />}
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
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
    },
    greeting: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#fff",
    },
    partnerText: {
        fontSize: 14,
        color: "#888",
        marginTop: 4,
    },
    statsContainer: {
        flexDirection: "row",
        paddingHorizontal: 24,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: "#16213e",
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    statNumber: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: "#888",
        marginTop: 4,
    },
    ctaCard: {
        margin: 24,
        backgroundColor: "#e94560",
        borderRadius: 16,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
    },
    ctaContent: {
        flex: 1,
    },
    ctaTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#fff",
    },
    ctaSubtitle: {
        fontSize: 14,
        color: "rgba(255,255,255,0.8)",
        marginTop: 4,
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
    },
    seeAll: {
        color: "#e94560",
        fontSize: 14,
    },
    matchItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16213e",
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    matchIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(233, 69, 96, 0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    matchText: {
        flex: 1,
        color: "#fff",
        fontSize: 14,
    },
    newBadge: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#e94560",
    },
});
