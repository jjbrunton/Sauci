import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Switch } from "react-native";
import { usePacksStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";

export default function PacksScreen() {
    const { packs, enabledPackIds, togglePack, isLoading, fetchPacks } = usePacksStore();

    useEffect(() => {
        fetchPacks();
    }, []);

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <TouchableOpacity
                style={styles.cardContent}
                activeOpacity={0.7}
                onPress={() => router.push(`/pack/${item.id}`)}
            >
                <View style={styles.iconContainer}>
                    <Text style={styles.emoji}>{item.icon || "📦"}</Text>
                </View>
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <Text style={styles.name}>{item.name}</Text>
                        {item.is_premium && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>PRO</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.description} numberOfLines={2}>
                        {item.description}
                    </Text>
                </View>
            </TouchableOpacity>
            <Switch
                value={enabledPackIds.includes(item.id)}
                onValueChange={() => togglePack(item.id)}
                trackColor={{ false: "#767577", true: "#e94560" }}
                thumbColor={"#fff"}
            />
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Question Packs</Text>
            </View>

            <FlatList
                data={packs}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshing={isLoading}
                onRefresh={fetchPacks}
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
    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16213e",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    cardContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    emoji: {
        fontSize: 24,
    },
    content: {
        flex: 1,
        marginRight: 16,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    name: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
        marginRight: 8,
    },
    badge: {
        backgroundColor: "#e94560",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "bold",
    },
    description: {
        fontSize: 14,
        color: "#888",
        lineHeight: 20,
    },
});
