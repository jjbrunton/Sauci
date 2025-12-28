import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { useAuthStore } from "../../../src/store";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Database } from "../../../src/types/supabase";
import { GradientBackground, GlassCard } from "../../../src/components/ui";
import { colors, gradients, spacing, radius, typography, blur, shadows } from "../../../src/theme";

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

        const fetchMatch = async () => {
            const { data } = await supabase
                .from("matches")
                .select("*, question:questions(*)")
                .eq("id", matchId)
                .single();

            if (data) {
                const { data: responses } = await supabase
                    .from("responses")
                    .select("*, profiles(name)")
                    .eq("question_id", data.question_id)
                    .eq("couple_id", data.couple_id);

                setMatch({ ...data, responses: responses || [] });
            }
        };
        fetchMatch();

        const fetchMessagesAndMarkRead = async () => {
            const { data } = await supabase
                .from("messages")
                .select("*")
                .eq("match_id", matchId)
                .order("created_at", { ascending: false });

            if (data) {
                setMessages(data);

                const unreadIds = data
                    .filter(m => m.user_id !== user?.id && !m.read_at)
                    .map(m => m.id);

                if (unreadIds.length > 0) {
                    await supabase
                        .from("messages")
                        .update({ read_at: new Date().toISOString() })
                        .in("id", unreadIds);

                    setMessages(prev => prev.map(m =>
                        unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m
                    ));
                }
            }
        };

        fetchMessagesAndMarkRead();

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

                    if (newMessage.user_id !== user?.id) {
                        await supabase
                            .from("messages")
                            .update({ read_at: new Date().toISOString() })
                            .eq("id", newMessage.id);
                        newMessage.read_at = new Date().toISOString();
                    }

                    setMessages((prev) => [newMessage, ...prev]);
                    setPartnerTyping(false);
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
        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, media_viewed_at: new Date().toISOString() } : m
        ));

        await supabase
            .from("messages")
            .update({ media_viewed_at: new Date().toISOString() })
            .eq("id", messageId);
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isMe = item.user_id === user?.id;
        return (
            <Animated.View
                entering={FadeInUp.delay(index * 30).duration(200)}
                style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}
            >
                {isMe ? (
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={[styles.bubble, styles.myBubble]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <MessageContent item={item} isMe={isMe} revealMessage={revealMessage} />
                    </LinearGradient>
                ) : (
                    <View style={[styles.bubble, styles.theirBubble]}>
                        <MessageContent item={item} isMe={isMe} revealMessage={revealMessage} />
                    </View>
                )}
            </Animated.View>
        );
    };

    return (
        <GradientBackground>
            <Stack.Screen options={{
                title: "Chat",
                headerStyle: { backgroundColor: colors.backgroundLight },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }} />

            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                {/* Sticky top bar with question and answers */}
                {match?.question && (
                    <GlassCard style={styles.stickyTopBar} noPadding>
                        <View style={styles.stickyContent}>
                            <Text style={styles.stickyQuestionText} numberOfLines={2}>
                                {match.question.text}
                                {match.question.partner_text ? ` & ${match.question.partner_text}` : ""}
                            </Text>
                            {match.responses && match.responses.length > 0 && (
                                <View style={styles.stickyAnswersContainer}>
                                    {match.responses.map((response: any) => (
                                        <View key={response.user_id} style={styles.answerBadge}>
                                            <Text style={styles.stickyAnswerText}>
                                                {response.user_id === user?.id ? 'You' : (response.profiles?.name || 'Partner')}: {response.answer}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </GlassCard>
                )}

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    inverted
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        partnerTyping ? (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                style={styles.typingContainer}
                            >
                                <Text style={styles.typingText}>Partner is typing...</Text>
                            </Animated.View>
                        ) : null
                    }
                />

                {/* Input bar with glass effect */}
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={blur.medium} tint="dark" style={styles.inputWrapper}>
                        <InputBar
                            inputText={inputText}
                            uploading={uploading}
                            onChangeText={handleTyping}
                            onSend={handleSend}
                            onPickImage={handlePickImage}
                        />
                    </BlurView>
                ) : (
                    <View style={[styles.inputWrapper, styles.inputWrapperAndroid]}>
                        <InputBar
                            inputText={inputText}
                            uploading={uploading}
                            onChangeText={handleTyping}
                            onSend={handleSend}
                            onPickImage={handlePickImage}
                        />
                    </View>
                )}
            </KeyboardAvoidingView>
        </GradientBackground>
    );
}

function MessageContent({
    item,
    isMe,
    revealMessage,
}: {
    item: Message;
    isMe: boolean;
    revealMessage: (id: string) => void;
}) {
    if (item.media_path) {
        return (
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
                            <Ionicons name="eye-off-outline" size={28} color={colors.text} />
                            <Text style={styles.revealText}>Tap to reveal</Text>
                        </View>
                    </TouchableOpacity>
                )}
                <MessageMeta item={item} isMe={isMe} />
            </View>
        );
    }

    return (
        <>
            <Text style={styles.messageText}>{item.content}</Text>
            <MessageMeta item={item} isMe={isMe} />
        </>
    );
}

function MessageMeta({ item, isMe }: { item: Message; isMe: boolean }) {
    return (
        <View style={styles.metaContainer}>
            <Text style={styles.timestamp}>
                {new Date(item.created_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
                <Ionicons
                    name={item.read_at ? "checkmark-done" : "checkmark"}
                    size={14}
                    color={item.read_at ? colors.success : "rgba(255,255,255,0.6)"}
                    style={styles.readIcon}
                />
            )}
        </View>
    );
}

function InputBar({
    inputText,
    uploading,
    onChangeText,
    onSend,
    onPickImage,
}: {
    inputText: string;
    uploading: boolean;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onPickImage: () => void;
}) {
    return (
        <View style={styles.inputContainer}>
            <TouchableOpacity onPress={onPickImage} disabled={uploading} style={styles.attachButton}>
                {uploading ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                    <Ionicons name="image-outline" size={24} color={colors.primary} />
                )}
            </TouchableOpacity>

            <View style={styles.inputFieldWrapper}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={onChangeText}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                />
            </View>

            <TouchableOpacity
                onPress={onSend}
                disabled={!inputText.trim()}
                style={[styles.sendButton, inputText.trim() && styles.sendButtonActive]}
            >
                <Ionicons
                    name="send"
                    size={20}
                    color={inputText.trim() ? colors.text : colors.textTertiary}
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    keyboardAvoiding: {
        flex: 1,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing.lg,
    },
    messageRow: {
        marginBottom: spacing.sm,
        flexDirection: "row",
    },
    myMessageRow: {
        justifyContent: "flex-end",
    },
    theirMessageRow: {
        justifyContent: "flex-start",
    },
    bubble: {
        maxWidth: "78%",
        padding: spacing.md,
        borderRadius: radius.xl,
        ...shadows.sm,
    },
    myBubble: {
        borderBottomRightRadius: radius.xs,
    },
    theirBubble: {
        backgroundColor: colors.glass.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderBottomLeftRadius: radius.xs,
    },
    messageText: {
        ...typography.body,
        color: colors.text,
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
    },
    metaContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: spacing.xs,
    },
    timestamp: {
        ...typography.caption2,
        color: "rgba(255, 255, 255, 0.6)",
    },
    readIcon: {
        marginLeft: spacing.xs,
    },
    inputWrapper: {
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    inputWrapperAndroid: {
        backgroundColor: colors.glass.backgroundLight,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: spacing.sm,
        paddingBottom: Platform.OS === "ios" ? spacing.xl : spacing.sm,
    },
    attachButton: {
        padding: spacing.sm,
        marginBottom: spacing.xs,
    },
    inputFieldWrapper: {
        flex: 1,
        backgroundColor: colors.glass.background,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginHorizontal: spacing.sm,
    },
    input: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.text,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.xs,
    },
    sendButtonActive: {
        backgroundColor: colors.primary,
    },
    typingContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    typingText: {
        ...typography.caption1,
        color: colors.textTertiary,
        fontStyle: "italic",
    },
    revealOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        borderRadius: radius.md,
    },
    revealContent: {
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: spacing.md,
        borderRadius: radius.md,
    },
    revealText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: "600",
        marginTop: spacing.xs,
    },
    stickyTopBar: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    stickyContent: {
        padding: spacing.md,
    },
    stickyQuestionText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "600",
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    stickyAnswersContainer: {
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.sm,
    },
    answerBadge: {
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
    },
    stickyAnswerText: {
        ...typography.caption1,
        color: colors.text,
    },
});
