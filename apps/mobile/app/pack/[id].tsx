import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase";
import { usePacksStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { Question } from "../../src/types";

type TooltipType = 'initiator' | 'coupleType' | null;

const TOOLTIP_CONTENT = {
    initiator: {
        title: 'Initiator Filter',
        description: 'The "initiator" is the first person in the couple to see and answer this question. This icon shows which genders can be the initiator. Their partner will always see the question afterward, regardless of this setting.',
    },
    coupleType: {
        title: 'Couple Type Filter',
        description: 'This shows which couple compositions can see this question. For example, a male+female icon means the question is only shown to couples where one partner is male and one is female.',
    },
};

export default function PackDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { packs, fetchPacks } = usePacksStore();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTooltip, setActiveTooltip] = useState<TooltipType>(null);

    const pack = packs.find((p) => p.id === id);

    useEffect(() => {
        if (packs.length === 0) {
            fetchPacks();
        }
        fetchPackDetails();
    }, [id]);

    const fetchPackDetails = async () => {
        try {
            const { data, error } = await supabase
                .from("questions")
                .select("*")
                .eq("pack_id", id)
                .order("created_at");

            if (error) throw error;
            setQuestions(data || []);
        } catch (error) {
            console.error("Error fetching questions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderItem = ({ item }: { item: Question }) => (
        <View style={styles.card}>
            <Text style={styles.questionText}>{item.text}</Text>
            {item.partner_text && (
                <Text style={styles.partnerText}>Partner role: {item.partner_text}</Text>
            )}
            <View style={styles.footerContainer}>
                <View style={styles.intensityContainer}>
                    {[...Array(5)].map((_, index) => (
                        <Ionicons
                            key={index}
                            name="flame"
                            size={12}
                            color={index < item.intensity ? "#e94560" : "#333"}
                            style={{ marginRight: 2 }}
                        />
                    ))}
                </View>
{/* Initiator indicator */}
                {item.target_user_genders && item.target_user_genders.length > 0 ? (
                    <View style={styles.targetsContainer}>
                        <Pressable
                            style={[styles.targetBadge, styles.initiatorBadge]}
                            onPress={() => setActiveTooltip('initiator')}
                        >
                            <Ionicons name="arrow-forward" size={12} color="#f39c12" style={{ marginRight: 4 }} />
                            {item.target_user_genders.map((g, i) => (
                                <Ionicons
                                    key={g}
                                    name={g === 'male' ? 'male' : g === 'female' ? 'female' : 'person'}
                                    size={14}
                                    color="#f39c12"
                                    style={i > 0 ? { marginLeft: 4 } : {}}
                                />
                            ))}
                            <Ionicons name="help-circle-outline" size={14} color="#f39c12" style={{ marginLeft: 6 }} />
                        </Pressable>
                    </View>
                ) : null}
                {/* Couple type indicator */}
                {item.allowed_couple_genders && item.allowed_couple_genders.length > 0 ? (
                    <Pressable
                        style={styles.targetsContainer}
                        onPress={() => setActiveTooltip('coupleType')}
                    >
                        {item.allowed_couple_genders.map((g) => {
                            const icons = [];
                            if (g === 'male+male') {
                                icons.push('male', 'male');
                            } else if (g === 'female+female') {
                                icons.push('female', 'female');
                            } else {
                                icons.push('male', 'female');
                            }

                            return (
                                <View key={g} style={styles.targetBadge}>
                                    {icons.map((icon, i) => (
                                        <Ionicons
                                            key={i}
                                            name={icon as any}
                                            size={14}
                                            color="#ccc"
                                            style={i > 0 ? { marginLeft: 4 } : {}}
                                        />
                                    ))}
                                </View>
                            );
                        })}
                        <Ionicons name="help-circle-outline" size={14} color="#ccc" style={{ marginLeft: 6 }} />
                    </Pressable>
                ) : (
                    <Pressable
                        style={styles.targetsContainer}
                        onPress={() => setActiveTooltip('coupleType')}
                    >
                        <View style={styles.targetBadge}>
                            <Ionicons name="people" size={14} color="#ccc" />
                        </View>
                        <Ionicons name="help-circle-outline" size={14} color="#ccc" style={{ marginLeft: 6 }} />
                    </Pressable>
                )}
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>{pack?.name || "Pack Details"}</Text>
                <View style={{ width: 24 }} />
            </View>

            {pack && (
                <View style={styles.packInfo}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.emoji}>{pack.icon || "📦"}</Text>
                    </View>
                    <Text style={styles.description}>{pack.description}</Text>
                </View>
            )}

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Questions ({questions.length})</Text>
            </View>

            <FlatList
                data={questions}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
            />

            {/* Tooltip Modal */}
            <Modal
                visible={activeTooltip !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setActiveTooltip(null)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setActiveTooltip(null)}
                >
                    <View style={styles.tooltipContainer}>
                        <Text style={styles.tooltipTitle}>
                            {activeTooltip && TOOLTIP_CONTENT[activeTooltip].title}
                        </Text>
                        <Text style={styles.tooltipDescription}>
                            {activeTooltip && TOOLTIP_CONTENT[activeTooltip].description}
                        </Text>
                        <TouchableOpacity
                            style={styles.tooltipButton}
                            onPress={() => setActiveTooltip(null)}
                        >
                            <Text style={styles.tooltipButtonText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a2e",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1a1a2e",
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 24,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#16213e",
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#fff",
    },
    packInfo: {
        padding: 24,
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#16213e",
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    emoji: {
        fontSize: 32,
    },
    description: {
        fontSize: 16,
        color: "#ccc",
        textAlign: "center",
        lineHeight: 24,
    },
    sectionHeader: {
        padding: 24,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#e94560",
    },
    list: {
        padding: 24,
    },
    card: {
        backgroundColor: "#16213e",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#0f3460",
    },
    questionText: {
        fontSize: 16,
        color: "#fff",
        marginBottom: 8,
        lineHeight: 22,
    },
    intensityContainer: {
        flexDirection: "row",
    },
    partnerText: {
        fontSize: 14,
        color: "#aaa",
        fontStyle: "italic",
        marginBottom: 8,
    },
    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    targetsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
    },
    targetBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    initiatorBadge: {
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
        borderColor: 'rgba(243, 156, 18, 0.3)',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    tooltipContainer: {
        backgroundColor: '#16213e',
        borderRadius: 16,
        padding: 24,
        maxWidth: 320,
        borderWidth: 1,
        borderColor: '#0f3460',
    },
    tooltipTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    tooltipDescription: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 22,
        marginBottom: 20,
    },
    tooltipButton: {
        backgroundColor: '#e94560',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tooltipButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
