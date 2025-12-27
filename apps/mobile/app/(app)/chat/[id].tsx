import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, AppState } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useAuthStore } from "../../../src/store";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Database } from "../../../src/types/supabase";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const matchId = id as string;
    const router = useRouter();
    const { user } = useAuthStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [match, setMatch] = useState<any>(null);
    const [inputText, setInputText] = useState("");
    const [uploading, setUploading] = useState(false);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!matchId) return;

        // Fetch match context (question and responses)
        const fetchMatch = async () => {
            const { data } = await supabase
                .from("matches")
                .select("*, question:questions(*)")
                .eq("id", matchId)
                .single();

            if (data) {
                // Fetch responses for both users in this couple for this question
                const { data: responses } = await supabase
                    .from("responses")
                    .select("*, profiles(name)")
                    .eq("question_id", data.question_id)
                    .eq("couple_id", data.couple_id);

                setMatch({ ...data, responses: responses || [] });
            }
        };
        fetchMatch();

        // Fetch initial messages and mark as read
        const fetchMessagesAndMarkRead = async () => {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("match_id", matchId)
                .order("created_at", { ascending: false });

            if (data) {
                setMessages(data);

                // Identify unread messages from partner
                const unreadIds = data
                    .filter(m => m.user_id !== user?.id && !m.read_at)
                    .map(m => m.id);

                if (unreadIds.length > 0) {
                    await supabase
                        .from("messages")
                        .update({ read_at: new Date().toISOString() })
                        .in("id", unreadIds);

                    // Optimistically update local state
                    setMessages(prev => prev.map(m =>
                        unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m
                    ));
                }
            }
        };

        fetchMessagesAndMarkRead();

        // Subscribe to new messages, updates (read receipts), and typing
        const channel = supabase
            .channel(`chat:${matchId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `match_id=eq.${matchId}`,
                },
                async (payload) => {
                    const newMessage = payload.new as Message;

                    // If receiving a message from partner, mark as read immediately since we are in the chat
                    if (newMessage.user_id !== user?.id) {
                        await supabase
                            .from("messages")
                            .update({ read_at: new Date().toISOString() })
                            .eq("id", newMessage.id);
                        newMessage.read_at = new Date().toISOString();
                    }

                    setMessages((prev) => [newMessage, ...prev]);
                    setPartnerTyping(false); // Stop typing indicator if they sent a message
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "messages",
                    filter: `match_id=eq.${matchId}`,
                },
                (payload) => {
                    const updatedMessage = payload.new as Message;
                    setMessages((prev) =>
                        prev.map(m => m.id === updatedMessage.id ? updatedMessage : m)
                    );
                }
            )
            .on("broadcast", { event: "typing" }, (payload) => {
                if (payload.payload.userId !== user?.id) {
                    setPartnerTyping(true);

                    // Auto-hide typing indicator after 3s
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                        setPartnerTyping(false);
                    }, 3000);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [matchId]);

    const handleTyping = (text: string) => {
        setInputText(text);

        if (text.length > 0) {
            supabase.channel(`chat:${matchId}`).send({
                type: "broadcast",
                event: "typing",
                payload: { userId: user?.id },
            });
        }
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;
        if (!user) return;

        const content = inputText.trim();
        setInputText("");

        const { error } = await supabase.from("messages").insert({
            match_id: matchId,
            user_id: user.id,
            content: content,
        });

        if (error) {
            Alert.alert("Error", "Failed to send message");
            setInputText(content);
        }
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        if (!user) return;
        setUploading(true);

        try {
            let fileBody;
            let ext = "jpg";

            if (Platform.OS === 'web') {
                const response = await fetch(uri);
                const blob = await response.blob();
                fileBody = blob;

                if (blob.type === 'image/png') ext = 'png';
                else if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') ext = 'jpg';
                else if (blob.type === 'image/gif') ext = 'gif';
                else if (blob.type === 'image/webp') ext = 'webp';
            } else {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                fileBody = decode(base64);

                const uriExt = uri.split('.').pop();
                if (uriExt && uriExt !== uri) {
                    ext = uriExt.toLowerCase();
                }
            }

            const fileName = `${matchId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

            const { error: uploadError } = await supabase.storage
                .from("chat-media")
                .upload(fileName, fileBody, {
                    contentType,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("chat-media")
                .getPublicUrl(fileName);

            await supabase.from("messages").insert({
                match_id: matchId,
                user_id: user.id,
                media_path: publicUrl,
            });

        } catch (error) {
            Alert.alert("Error", "Failed to upload image");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const revealMessage = async (messageId: string) => {
        // Optimistic update
        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, media_viewed_at: new Date().toISOString() } : m
        ));

        const { error } = await supabase
            .from("messages")
            .update({ media_viewed_at: new Date().toISOString() })
            .eq("id", messageId);

        if (error) {
            console.error("Failed to mark as viewed", error);
        }
    };


    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.user_id === user?.id;
        return (
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    {item.media_path ? (
                        <View>
                            <Image
                                source={{ uri: item.media_path }}
                                style={styles.messageImage}
                                blurRadius={(!isMe && !item.media_viewed_at) ? 20 : 0}
                            />
                            {(!isMe && !item.media_viewed_at) && (
                                <TouchableOpacity
                                    style={styles.revealOverlay}
                                    activeOpacity={0.8}
                                    onPress={() => revealMessage(item.id)}
                                >
                                    <View style={styles.revealContent}>
                                        <Ionicons name="eye-off-outline" size={32} color="#fff" />
                                        <Text style={styles.revealText}>Tap to reveal</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.messageText}>{item.content}</Text>
                    )}
                    <View style={styles.metaContainer}>
                        <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
                            {new Date(item.created_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isMe && (
                            <Ionicons
                                name={item.read_at ? "checkmark-done-outline" : "checkmark-outline"}
                                size={14}
                                color={item.read_at ? "#4cd137" : "rgba(255,255,255,0.7)"}
                                style={styles.readIcon}
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: "Chat",
                headerTitle: match?.question?.text ? () => (
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle} numberOfLines={2}>
                            {match.question.text}
                            {match.question.partner_text ? ` & ${match.question.partner_text}` : ""}
                        </Text>
                        {match.responses && match.responses.length > 0 && (
                            <View style={styles.answersContainer}>
                                {match.responses.map((response) => (
                                    <Text key={response.user_id} style={styles.answerText}>
                                        {response.profiles?.name || 'You'}: {response.answer}
                                    </Text>
                                ))}
                            </View>
                        )}
                    </View>
                ) : "Chat",
                headerStyle: { backgroundColor: "#16213e" },
                headerTintColor: "#fff",
                headerBackTitleVisible: false,
            }} />

            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                {/* Sticky top bar with question and answers */}
                {match?.question && (
                    <View style={styles.stickyTopBar}>
                        <Text style={styles.stickyQuestionText}>
                            {match.question.text}
                            {match.question.partner_text ? ` & ${match.question.partner_text}` : ""}
                        </Text>
                        {match.responses && match.responses.length > 0 && (
                            <View style={styles.stickyAnswersContainer}>
                                {match.responses.map((response) => (
                                    <Text key={response.user_id} style={styles.stickyAnswerText}>
                                        {response.user_id === user?.id ? 'You' : (response.profiles?.name || 'Partner')}: {response.answer}
                                    </Text>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    inverted
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={
                        partnerTyping ? (
                            <View style={styles.typingContainer}>
                                <Text style={styles.typingText}>Partner is typing...</Text>
                            </View>
                        ) : null
                    }
                />

                <View style={styles.inputContainer}>
                    <TouchableOpacity onPress={handlePickImage} disabled={uploading} style={styles.attachButton}>
                        {uploading ? (
                            <ActivityIndicator color="#e94560" size="small" />
                        ) : (
                            <Ionicons name="image-outline" size={24} color="#e94560" />
                        )}
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={handleTyping}
                        placeholder="Type a message..."
                        placeholderTextColor="#666"
                        multiline
                    />

                    <TouchableOpacity onPress={handleSend} disabled={!inputText.trim()} style={styles.sendButton}>
                        <Ionicons
                            name="send"
                            size={24}
                            color={inputText.trim() ? "#e94560" : "#666"}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a2e",
    },
    keyboardAvoiding: {
        flex: 1,
    },
    listContent: {
        padding: 16,
    },
    messageRow: {
        marginBottom: 16,
        flexDirection: "row",
    },
    myMessageRow: {
        justifyContent: "flex-end",
    },
    theirMessageRow: {
        justifyContent: "flex-start",
    },
    bubble: {
        maxWidth: "75%",
        padding: 12,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    myBubble: {
        backgroundColor: "#e94560",
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: "#16213e",
        borderWidth: 1,
        borderColor: "#0f3460",
        borderBottomLeftRadius: 4,
    },
    messageText: {
        color: "#fff",
        fontSize: 16,
        lineHeight: 22,
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        backgroundColor: "rgba(0,0,0,0.2)",
    },
    metaContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: 4,
    },
    timestamp: {
        fontSize: 10,
    },
    myTimestamp: {
        color: "rgba(255, 255, 255, 0.7)",
    },
    theirTimestamp: {
        color: "rgba(255, 255, 255, 0.4)",
    },
    readIcon: {
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        paddingBottom: Platform.OS === "ios" ? 34 : 12,
        backgroundColor: "#16213e",
        borderTopWidth: 1,
        borderTopColor: "#0f3460",
    },
    attachButton: {
        padding: 10,
    },
    input: {
        flex: 1,
        backgroundColor: "#0f3460",
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: "#fff",
        maxHeight: 120,
        marginHorizontal: 8,
        fontSize: 16,
    },
    sendButton: {
        padding: 10,
    },
    headerTitleContainer: {
        alignItems: "center",
        maxWidth: 200,
    },
    headerTitle: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
        textAlign: "center",
    },
    answersContainer: {
        marginTop: 4,
        alignItems: "center",
    },
    answerText: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 12,
        marginBottom: 2,
    },
    typingContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typingText: {
        color: "#666",
        fontStyle: "italic",
        fontSize: 12,
    },
    revealOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 12,
    },
    revealContent: {
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: 12,
        borderRadius: 12,
    },
    revealText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "bold",
        marginTop: 4,
    },
    stickyTopBar: {
        backgroundColor: "#16213e",
        borderBottomWidth: 1,
        borderBottomColor: "#0f3460",
        padding: 16,
        paddingTop: 12,
        paddingBottom: 12,
    },
    stickyQuestionText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 8,
    },
    stickyAnswersContainer: {
        alignItems: "center",
    },
    stickyAnswerText: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 14,
        marginBottom: 4,
    }
});
