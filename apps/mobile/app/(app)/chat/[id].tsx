import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Modal, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { useAuthStore, useMessageStore } from "../../../src/store";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Database } from "../../../src/types/supabase";
import { GradientBackground } from "../../../src/components/ui";
import { colors, gradients, spacing, radius, typography } from "../../../src/theme";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const matchId = id as string;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { setActiveMatchId, markMatchMessagesAsRead } = useMessageStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [match, setMatch] = useState<any>(null);
    const [inputText, setInputText] = useState("");
    const [uploading, setUploading] = useState(false);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFocusedRef = useRef(false);

    // Track active chat to prevent notifications for current chat
    // Use useFocusEffect because screens don't unmount on navigation
    useFocusEffect(
        useCallback(() => {
            isFocusedRef.current = true;
            if (matchId) {
                setActiveMatchId(matchId);
                markMatchMessagesAsRead(matchId);
            }
            return () => {
                isFocusedRef.current = false;
                setActiveMatchId(null);
            };
        }, [matchId, setActiveMatchId, markMatchMessagesAsRead])
    );

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

                const now = new Date().toISOString();

                // Get partner messages that need to be marked as delivered or read
                const partnerMessages = data.filter(m => m.user_id !== user?.id);
                const undeliveredIds = partnerMessages.filter(m => !m.delivered_at).map(m => m.id);
                const unreadIds = partnerMessages.filter(m => !m.read_at).map(m => m.id);

                // Mark as both delivered and read (since user is viewing the chat)
                if (unreadIds.length > 0) {
                    await supabase
                        .from("messages")
                        .update({ delivered_at: now, read_at: now })
                        .in("id", unreadIds);

                    setMessages(prev => prev.map(m =>
                        unreadIds.includes(m.id) ? { ...m, delivered_at: now, read_at: now } : m
                    ));
                } else if (undeliveredIds.length > 0) {
                    // Only mark as delivered if already read but not delivered (edge case)
                    await supabase
                        .from("messages")
                        .update({ delivered_at: now })
                        .in("id", undeliveredIds);

                    setMessages(prev => prev.map(m =>
                        undeliveredIds.includes(m.id) ? { ...m, delivered_at: now } : m
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
                    const now = new Date().toISOString();

                    if (newMessage.user_id !== user?.id && isFocusedRef.current) {
                        // Mark as both delivered and read (only if screen is focused)
                        await supabase
                            .from("messages")
                            .update({ delivered_at: now, read_at: now })
                            .eq("id", newMessage.id);
                        newMessage.delivered_at = now;
                        newMessage.read_at = now;
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

            // Store just the path, not the full URL (bucket is private)
            await supabase.from("messages").insert({
                match_id: matchId,
                user_id: user.id,
                media_path: fileName,
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
                        <MessageContent item={item} isMe={isMe} revealMessage={revealMessage} onImagePress={setFullScreenImage} />
                    </LinearGradient>
                ) : (
                    <View style={[styles.bubble, styles.theirBubble]}>
                        <MessageContent item={item} isMe={isMe} revealMessage={revealMessage} onImagePress={setFullScreenImage} />
                    </View>
                )}
            </Animated.View>
        );
    };

    const isYesYes = match?.match_type === "yes_yes";

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}
            >
                {/* Custom Header */}
                <View style={[styles.header, { paddingTop: insets.top }]}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Chat</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Question Header */}
                {match?.question && (
                    <View style={styles.questionHeader}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.questionIconGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons
                                name={isYesYes ? "heart" : "heart-half"}
                                size={16}
                                color={colors.text}
                            />
                        </LinearGradient>
                        <View style={styles.questionContent}>
                            <Text style={styles.questionText} numberOfLines={2}>
                                {match.question.text}
                                {match.question.partner_text ? ` / ${match.question.partner_text}` : ""}
                            </Text>
                            {match.responses && match.responses.length > 0 && (
                                <View style={styles.answersRow}>
                                    {match.responses.map((response: any) => (
                                        <View key={response.user_id} style={styles.answerChip}>
                                            <Text style={styles.answerName}>
                                                {response.user_id === user?.id ? 'You' : (response.profiles?.name?.split(' ')[0] || 'Partner')}
                                            </Text>
                                            <View style={[
                                                styles.answerDot,
                                                response.answer === 'yes' && styles.answerDotYes,
                                                response.answer === 'maybe' && styles.answerDotMaybe
                                            ]} />
                                            <Text style={styles.answerText}>{response.answer}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Messages List */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    inverted
                    style={styles.messageList}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        partnerTyping ? (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                style={styles.typingContainer}
                            >
                                <View style={styles.typingBubble}>
                                    <View style={styles.typingDots}>
                                        <View style={[styles.typingDot, styles.typingDot1]} />
                                        <View style={[styles.typingDot, styles.typingDot2]} />
                                        <View style={[styles.typingDot, styles.typingDot3]} />
                                    </View>
                                </View>
                            </Animated.View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.emptyChatIcon}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="chatbubbles-outline" size={24} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.emptyChatText}>Start the conversation!</Text>
                        </View>
                    }
                />

                {/* Input Bar */}
                <View style={[styles.inputWrapper, { paddingBottom: insets.bottom || spacing.sm }]}>
                    <InputBar
                        inputText={inputText}
                        uploading={uploading}
                        onChangeText={handleTyping}
                        onSend={handleSend}
                        onPickImage={handlePickImage}
                    />
                </View>
            </KeyboardAvoidingView>

            {/* Full Screen Image Modal */}
            <Modal
                visible={!!fullScreenImage}
                transparent
                animationType="fade"
                onRequestClose={() => setFullScreenImage(null)}
            >
                <View style={styles.fullScreenOverlay}>
                    <TouchableOpacity
                        style={styles.fullScreenCloseButton}
                        onPress={() => setFullScreenImage(null)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="close" size={28} color={colors.text} />
                    </TouchableOpacity>
                    {fullScreenImage && (
                        <Image
                            source={{ uri: fullScreenImage }}
                            style={styles.fullScreenImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </GradientBackground>
    );
}

// Extract storage path from media_path (handles both old full URLs and new path-only format)
function getStoragePath(mediaPath: string): string {
    if (mediaPath.startsWith('http')) {
        // Old format: extract path from full URL
        const match = mediaPath.match(/\/chat-media\/(.+)$/);
        return match ? match[1] : mediaPath;
    }
    return mediaPath;
}

function MessageContent({
    item,
    isMe,
    revealMessage,
    onImagePress,
}: {
    item: Message;
    isMe: boolean;
    revealMessage: (id: string) => void;
    onImagePress: (uri: string) => void;
}) {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [urlError, setUrlError] = useState(false);

    useEffect(() => {
        if (!item.media_path) return;

        const fetchSignedUrl = async () => {
            const storagePath = getStoragePath(item.media_path!);
            const { data, error } = await supabase.storage
                .from('chat-media')
                .createSignedUrl(storagePath, 3600); // 1 hour expiry

            if (error) {
                console.error('Failed to get signed URL:', error);
                setUrlError(true);
                return;
            }

            if (data?.signedUrl) {
                setSignedUrl(data.signedUrl);
            } else {
                setUrlError(true);
            }
        };

        fetchSignedUrl();
    }, [item.media_path]);

    if (item.media_path) {
        const isViewed = !!item.media_viewed_at;
        const canOpenFullScreen = isMe || isViewed;

        return (
            <View>
                <TouchableOpacity
                    activeOpacity={canOpenFullScreen ? 0.8 : 1}
                    onPress={() => canOpenFullScreen && signedUrl && onImagePress(signedUrl)}
                    disabled={!canOpenFullScreen || !signedUrl}
                >
                    {signedUrl ? (
                        <Image
                            source={{ uri: signedUrl }}
                            style={styles.messageImage}
                            blurRadius={(!isMe && !isViewed) ? 20 : 0}
                        />
                    ) : urlError ? (
                        <View style={[styles.messageImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }]}>
                            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>Image unavailable</Text>
                        </View>
                    ) : (
                        <View style={[styles.messageImage, { justifyContent: 'center', alignItems: 'center' }]}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    )}
                </TouchableOpacity>
                {/* Reveal overlay for recipient */}
                {(!isMe && !isViewed) && (
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
                {/* Viewed indicator for sender */}
                {isMe && isViewed && (
                    <View style={styles.viewedBadge}>
                        <Ionicons name="eye" size={12} color={colors.success} />
                        <Text style={styles.viewedText}>Viewed</Text>
                    </View>
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
    // 3-state read receipts:
    // - Single tick (grey) = sent to server
    // - Double tick (grey) = delivered to partner's device
    // - Double tick (blue) = read by partner
    const isDelivered = !!item.delivered_at;
    const isRead = !!item.read_at;

    const getStatusIcon = () => {
        if (isRead) {
            // Double tick blue - read
            return <Ionicons name="checkmark-done" size={16} color="#34B7F1" />;
        } else if (isDelivered) {
            // Double tick grey - delivered but not read
            return <Ionicons name="checkmark-done" size={16} color="rgba(255,255,255,0.5)" />;
        } else {
            // Single tick grey - sent but not delivered
            return <Ionicons name="checkmark" size={16} color="rgba(255,255,255,0.5)" />;
        }
    };

    return (
        <View style={styles.metaContainer}>
            <Text style={styles.timestamp}>
                {new Date(item.created_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
                <View style={styles.readStatus}>
                    {getStatusIcon()}
                </View>
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
                    <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
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
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={inputText.trim() ? gradients.primary as [string, string] : [colors.glass.background, colors.glass.background]}
                    style={styles.sendButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons
                        name="send"
                        size={18}
                        color={inputText.trim() ? colors.text : colors.textTertiary}
                    />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    keyboardAvoiding: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.sm,
        backgroundColor: colors.backgroundLight,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        ...typography.headline,
        color: colors.text,
        flex: 1,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    questionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.glass.backgroundLight,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    messageList: {
        flex: 1,
    },
    questionIconGradient: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    questionContent: {
        flex: 1,
    },
    questionText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: '500',
        lineHeight: 20,
    },
    answersRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xs,
    },
    answerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    answerName: {
        ...typography.caption2,
        color: colors.textSecondary,
    },
    answerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.textTertiary,
    },
    answerDotYes: {
        backgroundColor: colors.success,
    },
    answerDotMaybe: {
        backgroundColor: colors.warning,
    },
    answerText: {
        ...typography.caption2,
        color: colors.textSecondary,
        textTransform: 'capitalize',
    },
    listContent: {
        flexGrow: 1,
        padding: spacing.md,
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
        borderRadius: radius.lg,
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
        lineHeight: 22,
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
        color: "rgba(255, 255, 255, 0.5)",
    },
    readStatus: {
        marginLeft: spacing.xs,
    },
    viewedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        position: 'absolute',
        top: spacing.sm,
        left: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.sm,
    },
    viewedText: {
        ...typography.caption2,
        color: colors.success,
        fontWeight: '600',
    },
    emptyChat: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyChatIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptyChatText: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    inputWrapper: {
        backgroundColor: colors.backgroundLight,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: spacing.sm,
        gap: spacing.sm,
    },
    attachButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputFieldWrapper: {
        flex: 1,
        backgroundColor: colors.glass.background,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
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
        justifyContent: "center",
        alignItems: "center",
    },
    typingContainer: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    typingBubble: {
        backgroundColor: colors.glass.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: radius.lg,
        borderBottomLeftRadius: radius.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        alignSelf: 'flex-start',
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.textTertiary,
    },
    typingDot1: {
        opacity: 0.4,
    },
    typingDot2: {
        opacity: 0.6,
    },
    typingDot3: {
        opacity: 0.8,
    },
    revealOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
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
    fullScreenOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        justifyContent: "center",
        alignItems: "center",
    },
    fullScreenCloseButton: {
        position: "absolute",
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    fullScreenImage: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height * 0.8,
    },
});
