import { useState, useEffect } from "react";
import { View, StyleSheet, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import SwipeCard from "../../src/components/SwipeCard";

export default function SwipeScreen() {
    const { packId } = useLocalSearchParams();
    const [questions, setQuestions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        fetchQuestions();
    }, [packId]);

    const fetchQuestions = async () => {
        try {
            const { data, error } = await supabase.rpc("get_recommended_questions", {
                target_pack_id: packId || null
            });

            if (error) {
                console.error("Error fetching recommended questions:", error);
                throw error;
            }

            // Smart Shuffle
            // Priority:
            // 1. Completion of Two-Part Match (Partner answered, is_two_part = true) -> +1.5
            // 2. Partner Answered (Any) -> +0.7
            // 3. New Two-Part (Get someone to start) -> +0.4
            const sorted = (data || []).sort((a: any, b: any) => {
                let scoreA = Math.random();
                let scoreB = Math.random();

                if (a.partner_answered && a.is_two_part) scoreA += 1.5;
                else if (a.partner_answered) scoreA += 0.7;
                else if (a.is_two_part) scoreA += 0.4;

                if (b.partner_answered && b.is_two_part) scoreB += 1.5;
                else if (b.partner_answered) scoreB += 0.7;
                else if (b.is_two_part) scoreB += 0.4;

                return scoreB - scoreA;
            });

            setQuestions(sorted);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwipe = async (direction: "left" | "right" | "up") => {
        const question = questions[currentIndex];
        const answer = direction === "right" ? "yes" : direction === "left" ? "no" : "maybe";

        // Optimistic update
        setCurrentIndex(prev => prev + 1);

        try {
            // DEBUG: Check if we have a valid session
            const { data: { session } } = await supabase.auth.getSession();
            console.log("DEBUG - Session exists:", !!session);
            console.log("DEBUG - Access token exists:", !!session?.access_token);
            console.log("DEBUG - Token preview:", session?.access_token?.substring(0, 50) + "...");

            const result = await supabase.functions.invoke("submit-response", {
                body: {
                    question_id: question.id,
                    answer,
                },
            });
            console.log("DEBUG - Function result:", result);
        } catch (error) {
            console.error("Failed to submit response", error);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    if (currentIndex >= questions.length) {
        return (
            <View style={styles.container}>
                <Ionicons name="checkmark-circle-outline" size={80} color="#e94560" />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>
                    Check back later for more questions or try a different pack.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.progress}>
                    Question {currentIndex + 1} of {questions.length}
                </Text>
            </View>

            <View style={styles.cardContainer}>
                {/* Render next card in background for smoothness */}
                {questions[currentIndex + 1] && (
                    <View style={[styles.backgroundCard]} />
                )}

                {/* Active card */}
                <SwipeCard
                    key={questions[currentIndex].id}
                    question={questions[currentIndex]}
                    onSwipe={handleSwipe}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a2e",
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        position: "absolute",
        top: 60,
        zIndex: 1,
    },
    progress: {
        color: "#666",
        fontSize: 16,
        fontWeight: "600",
    },
    cardContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 40,
    },
    backgroundCard: {
        position: "absolute",
        width: "100%", // Match SwipeCard width logic
        height: 500,
        backgroundColor: "#16213e",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#0f3460",
        transform: [{ scale: 0.95 }, { translateY: 10 }],
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
        marginTop: 24,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: "#888",
        textAlign: "center",
        paddingHorizontal: 40,
    },
});
