import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeInUp,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    interpolate,
    Easing,
} from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { useAuthStore, useMessageStore } from "../../../src/store";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from 'expo-file-system';
import { Video as VideoCompressor } from 'react-native-compressor';
import { decode } from 'base64-arraybuffer';
import { Database } from "../../../src/types/supabase";
import { GradientBackground } from "../../../src/components/ui";
import { colors, gradients, spacing, radius, typography, shadows } from "../../../src/theme";
import { Events } from "../../../src/lib/analytics";
import { getCachedSignedUrl, getStoragePath, getVideoCachedUri, cacheVideo } from "../../../src/lib/imageCache";

type Message = Database["public"]["Tables"]["messages"]["Row"];

// Upload status for skeleton display
type UploadStatus = {
    mediaType: 'image' | 'video';
    status: 'compressing' | 'uploading';
    thumbnailUri?: string;
} | null;

// Premium color palette for Chat (matches feature uses gold)
const ACCENT = colors.premium.gold;
const ACCENT_DARK = colors.premium.goldDark;
const ACCENT_RGBA = 'rgba(212, 175, 55, ';
const ROSE = colors.premium.rose;
const ROSE_RGBA = 'rgba(232, 164, 174, ';

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const matchId = id as string;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, partner } = useAuthStore();
    const { setActiveMatchId, markMatchMessagesAsRead } = useMessageStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [match, setMatch] = useState<any>(null);
    const [inputText, setInputText] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>(null);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [fullScreenImageLoading, setFullScreenImageLoading] = useState(true);
    const [fullScreenVideo, setFullScreenVideo] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFocusedRef = useRef(false);

    // Ambient orb breathing animations
    const orbBreathing1 = useSharedValue(0);
    const orbBreathing2 = useSharedValue(0);
    const orbDrift = useSharedValue(0);

    useEffect(() => {
        // Primary orb breathing - 6 second cycle
        orbBreathing1.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Secondary orb breathing - offset timing for variation
        orbBreathing2.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Subtle vertical drift - 8 second cycle
        orbDrift.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const orbStyle1 = useAnimatedStyle(() => ({
        opacity: interpolate(orbBreathing1.value, [0, 1], [0.2, 0.4]),
        transform: [
            { translateY: interpolate(orbDrift.value, [0, 1], [0, -20]) },
            { scale: interpolate(orbBreathing1.value, [0, 1], [1, 1.1]) },
        ],
    }));

    const orbStyle2 = useAnimatedStyle(() => ({
        opacity: interpolate(orbBreathing2.value, [0, 1], [0.15, 0.35]),
        transform: [
            { translateY: interpolate(orbDrift.value, [0, 1], [20, 0]) },
            { scale: interpolate(orbBreathing2.value, [0, 1], [1, 1.1]) },
        ],
    }));

    // Track active chat to prevent notifications for current chat
    // Use useFocusEffect because screens don't unmount on navigation
    useFocusEffect(
        useCallback(() => {
            isFocusedRef.current = true;
            if (matchId) {
                setActiveMatchId(matchId);
                markMatchMessagesAsRead(matchId);
                Events.matchViewed();
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
        } else {
            Events.messageSent();
        }
    };

    const handlePickMedia = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.7,
            videoMaxDuration: 300, // 5 min max
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            const isVideo = asset.type === 'video';
            uploadMedia(asset.uri, isVideo ? 'video' : 'image');
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                "Camera Permission",
                "Please allow camera access to take photos."
            );
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
        });

        if (!result.canceled) {
            uploadMedia(result.assets[0].uri, 'image');
        }
    };

    const handleRecordVideo = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert(
                "Camera Permission",
                "Please allow camera access to record videos."
            );
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.7,
            videoMaxDuration: 60, // 1 min for camera recording
        });

        if (!result.canceled) {
            uploadMedia(result.assets[0].uri, 'video');
        }
    };

    const uploadMedia = async (uri: string, mediaType: 'image' | 'video') => {
        if (!user) return;
        setUploading(true);
        setUploadStatus({ mediaType, status: mediaType === 'video' ? 'compressing' : 'uploading', thumbnailUri: uri });

        try {
            let fileUri = uri;
            let fileBody;
            let ext = mediaType === 'video' ? 'mp4' : 'jpg';

            // Compress videos on native platforms before upload
            if (mediaType === 'video' && Platform.OS !== 'web') {
                try {
                    console.log('Compressing video...');
                    fileUri = await VideoCompressor.compress(uri, {
                        compressionMethod: 'auto',
                        maxSize: 720, // Max 720p resolution
                        minimumFileSizeForCompress: 0, // Always compress
                    });
                    console.log('Video compressed successfully');
                    ext = 'mp4'; // Compressed videos are always mp4
                    // Update status to uploading after compression
                    setUploadStatus({ mediaType, status: 'uploading', thumbnailUri: uri });
                } catch (compressError) {
                    console.warn('Video compression failed, uploading original:', compressError);
                    // Fall back to original if compression fails
                    fileUri = uri;
                    setUploadStatus({ mediaType, status: 'uploading', thumbnailUri: uri });
                }
            }

            if (Platform.OS === 'web') {
                const response = await fetch(fileUri);
                const blob = await response.blob();
                fileBody = blob;

                // Detect extension from blob type
                if (mediaType === 'video') {
                    if (blob.type === 'video/mp4') ext = 'mp4';
                    else if (blob.type === 'video/quicktime') ext = 'mov';
                    else if (blob.type === 'video/webm') ext = 'webm';
                } else {
                    if (blob.type === 'image/png') ext = 'png';
                    else if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') ext = 'jpg';
                    else if (blob.type === 'image/gif') ext = 'gif';
                    else if (blob.type === 'image/webp') ext = 'webp';
                }
            } else {
                const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
                fileBody = decode(base64);

                if (mediaType !== 'video') {
                    // Only use URI extension for non-videos (videos are always mp4 after compression)
                    const uriExt = fileUri.split('.').pop();
                    if (uriExt && uriExt !== fileUri) {
                        ext = uriExt.toLowerCase();
                    }
                }
            }

            const fileName = `${matchId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const contentType = mediaType === 'video'
                ? `video/${ext === 'mov' ? 'quicktime' : ext}`
                : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

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
                media_type: mediaType,
            });
            Events.mediaUploaded();

        } catch (error) {
            Alert.alert("Error", `Failed to upload ${mediaType}`);
            console.error(error);
        } finally {
            setUploading(false);
            setUploadStatus(null);
        }
    };

    const revealMessage = async (messageId: string) => {
        const message = messages.find(m => m.id === messageId);
        const now = new Date();
        // Set expiration 30 days from now for videos only
        const expiresAt = message?.media_type === 'video'
            ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null;

        setMessages(prev => prev.map(m =>
            m.id === messageId ? {
                ...m,
                media_viewed_at: now.toISOString(),
                media_expires_at: expiresAt
            } : m
        ));

        await supabase
            .from("messages")
            .update({
                media_viewed_at: now.toISOString(),
                media_expires_at: expiresAt
            })
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
                    <View style={styles.myBubbleContainer}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={[styles.bubble, styles.myBubble]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {/* Silk highlight */}
                            <LinearGradient
                                colors={['rgba(255, 255, 255, 0.15)', 'transparent']}
                                style={styles.bubbleSilkHighlight}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                            />
                            <MessageContent item={item} isMe={isMe} revealMessage={revealMessage} onImagePress={setFullScreenImage} onVideoFullScreen={setFullScreenVideo} />
                        </LinearGradient>
                    </View>
                ) : (
                    <View style={styles.theirBubbleContainer}>
                        <View style={[styles.bubble, styles.theirBubble]}>
                            {/* Subtle gradient background */}
                            <LinearGradient
                                colors={['rgba(22, 33, 62, 0.6)', 'rgba(13, 13, 26, 0.8)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {/* Silk highlight */}
                            <LinearGradient
                                colors={[`${ACCENT_RGBA}0.08)`, 'transparent']}
                                style={styles.bubbleSilkHighlight}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                            />
                            <MessageContent item={item} isMe={isMe} revealMessage={revealMessage} onImagePress={setFullScreenImage} onVideoFullScreen={setFullScreenVideo} />
                        </View>
                    </View>
                )}
            </Animated.View>
        );
    };

    const isYesYes = match?.match_type === "yes_yes";

    return (
        <GradientBackground>
            {/* Ambient Orbs - Gold/Rose for matches feature */}
            <Animated.View style={[styles.ambientOrb, styles.orbTopRight, orbStyle1]} pointerEvents="none">
                <LinearGradient
                    colors={[colors.premium.goldGlow, 'transparent']}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>
            <Animated.View style={[styles.ambientOrb, styles.orbBottomLeft, orbStyle2]} pointerEvents="none">
                <LinearGradient
                    colors={[`${ROSE_RGBA}0.2)`, 'transparent']}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0, y: 0 }}
                />
            </Animated.View>

            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}
            >
                {/* Premium Header */}
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
                >
                    {/* Gradient background */}
                    <LinearGradient
                        colors={['rgba(22, 33, 62, 0.8)', 'rgba(13, 13, 26, 0.6)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />
                    {/* Top silk highlight */}
                    <LinearGradient
                        colors={[`${ACCENT_RGBA}0.1)`, 'transparent']}
                        style={styles.headerSilkHighlight}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />

                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <View style={styles.backButtonInner}>
                            <Ionicons name="chevron-back" size={20} color={ACCENT} />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        {partner?.avatar_url ? (
                            <View style={styles.headerAvatarContainer}>
                                <Image
                                    source={{ uri: partner.avatar_url }}
                                    style={styles.headerAvatar}
                                    cachePolicy="disk"
                                    transition={200}
                                />
                                {/* Avatar ring */}
                                <View style={styles.avatarRing} />
                            </View>
                        ) : (
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.headerAvatarGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.headerAvatarText}>
                                    {partner?.name?.[0]?.toUpperCase() || "P"}
                                </Text>
                            </LinearGradient>
                        )}
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerLabel}>CONVERSATION WITH</Text>
                            <Text style={styles.headerTitle}>{partner?.name || "Partner"}</Text>
                        </View>
                    </View>

                    <View style={styles.headerSpacer} />

                    {/* Bottom border */}
                    <View style={styles.headerBorderBottom} />
                </Animated.View>

                {/* Premium Match Card */}
                {match?.question && (
                    <Animated.View
                        entering={FadeInDown.delay(100).duration(400).springify()}
                        style={styles.matchCard}
                    >
                        {/* Card gradient background */}
                        <LinearGradient
                            colors={isYesYes
                                ? ['rgba(212, 175, 55, 0.12)', 'rgba(184, 134, 11, 0.08)']
                                : ['rgba(232, 164, 174, 0.1)', 'rgba(22, 33, 62, 0.6)']
                            }
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />

                        {/* Top glow for YES+YES */}
                        {isYesYes && (
                            <LinearGradient
                                colors={[`${ACCENT_RGBA}0.15)`, 'transparent']}
                                style={styles.matchCardGlow}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                            />
                        )}

                        {/* Match Label */}
                        <Text style={[styles.matchLabel, isYesYes && styles.matchLabelYesYes]}>
                            {isYesYes ? "PERFECT MATCH" : "SOFT MATCH"}
                        </Text>

                        {/* Decorative Separator */}
                        <View style={styles.matchSeparator}>
                            <View style={[styles.matchSeparatorLine, isYesYes && styles.matchSeparatorLineYesYes]} />
                            <View style={[styles.matchSeparatorDiamond, isYesYes && styles.matchSeparatorDiamondYesYes]} />
                            <View style={[styles.matchSeparatorLine, isYesYes && styles.matchSeparatorLineYesYes]} />
                        </View>

                        {/* Question Text */}
                        <Text style={styles.matchQuestionText}>
                            "{match.question.text}"
                        </Text>
                        {match.question.partner_text && (
                            <Text style={styles.matchQuestionPartnerText}>
                                "{match.question.partner_text}"
                            </Text>
                        )}

                        {/* Response Pills */}
                        {match.responses && match.responses.length > 0 && (
                            <View style={styles.responsePillsRow}>
                                {match.responses.map((response: any) => {
                                    const isUser = response.user_id === user?.id;
                                    const isYes = response.answer === 'yes';
                                    return (
                                        <View key={response.user_id} style={styles.responsePillWrapper}>
                                            {isYes ? (
                                                <LinearGradient
                                                    colors={isYesYes
                                                        ? gradients.premiumGold as [string, string]
                                                        : [colors.success, '#27ae60']
                                                    }
                                                    style={styles.responsePill}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <Ionicons name="checkmark" size={12} color={colors.text} />
                                                    <Text style={styles.responsePillText}>
                                                        {isUser ? 'You' : (response.profiles?.name?.split(' ')[0] || 'Partner')}
                                                    </Text>
                                                </LinearGradient>
                                            ) : (
                                                <View style={styles.responsePillMaybe}>
                                                    <Ionicons name="help" size={12} color={colors.warning} />
                                                    <Text style={styles.responsePillTextMaybe}>
                                                        {isUser ? 'You' : (response.profiles?.name?.split(' ')[0] || 'Partner')}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Premium border */}
                        <View style={[
                            styles.matchCardBorder,
                            isYesYes && styles.matchCardBorderYesYes
                        ]} pointerEvents="none" />
                    </Animated.View>
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
                        <>
                            {/* Show uploading skeleton when media is being uploaded */}
                            {uploadStatus && <UploadingSkeleton uploadStatus={uploadStatus} />}

                            {/* Show typing indicator when partner is typing */}
                            {partnerTyping && (
                                <Animated.View
                                    entering={FadeIn.duration(200)}
                                    style={styles.typingContainer}
                                >
                                    <View style={styles.typingBubble}>
                                        {/* Subtle gradient */}
                                        <LinearGradient
                                            colors={['rgba(22, 33, 62, 0.6)', 'rgba(13, 13, 26, 0.8)']}
                                            style={StyleSheet.absoluteFill}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        />
                                        <View style={styles.typingDots}>
                                            <TypingDot delay={0} />
                                            <TypingDot delay={150} />
                                            <TypingDot delay={300} />
                                        </View>
                                    </View>
                                </Animated.View>
                            )}
                        </>
                    }
                    ListEmptyComponent={
                        <Animated.View
                            entering={FadeIn.delay(200).duration(400)}
                            style={styles.emptyChat}
                        >
                            {/* Premium icon */}
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="chatbubbles-outline" size={32} color={ACCENT} />
                            </View>

                            {/* Decorative separator */}
                            <View style={styles.emptySeparator}>
                                <View style={styles.emptySeparatorLine} />
                                <View style={styles.emptySeparatorDiamond} />
                                <View style={styles.emptySeparatorLine} />
                            </View>

                            <Text style={styles.emptyChatTitle}>Start the Conversation</Text>
                            <Text style={styles.emptyChatSubtitle}>
                                Share your thoughts about this match
                            </Text>
                        </Animated.View>
                    }
                />

                {/* Premium Input Bar */}
                <Animated.View
                    entering={FadeInDown.duration(300)}
                    style={[styles.inputWrapper, { paddingBottom: insets.bottom || spacing.sm }]}
                >
                    {/* Gradient background */}
                    <LinearGradient
                        colors={['rgba(22, 33, 62, 0.9)', 'rgba(13, 13, 26, 0.95)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />
                    {/* Top border glow */}
                    <View style={styles.inputWrapperBorder} />

                    <InputBar
                        inputText={inputText}
                        uploading={uploading}
                        onChangeText={handleTyping}
                        onSend={handleSend}
                        onPickMedia={handlePickMedia}
                        onTakePhoto={handleTakePhoto}
                        onRecordVideo={handleRecordVideo}
                    />
                </Animated.View>
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
                        <LinearGradient
                            colors={gradients.premiumGold as [string, string]}
                            style={styles.fullScreenCloseGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </LinearGradient>
                    </TouchableOpacity>
                    {fullScreenImageLoading && (
                        <ActivityIndicator size="large" color={ACCENT} style={styles.fullScreenSpinner} />
                    )}
                    {fullScreenImage && (
                        <Image
                            source={{ uri: fullScreenImage }}
                            style={styles.fullScreenImage}
                            contentFit="contain"
                            cachePolicy="disk"
                            onLoadStart={() => setFullScreenImageLoading(true)}
                            onLoadEnd={() => setFullScreenImageLoading(false)}
                        />
                    )}
                </View>
            </Modal>

            {/* Full Screen Video Modal */}
            <Modal
                visible={!!fullScreenVideo}
                transparent
                animationType="fade"
                onRequestClose={() => setFullScreenVideo(null)}
            >
                <View style={styles.fullScreenOverlay}>
                    <TouchableOpacity
                        style={styles.fullScreenCloseButton}
                        onPress={() => setFullScreenVideo(null)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={gradients.premiumGold as [string, string]}
                            style={styles.fullScreenCloseGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </LinearGradient>
                    </TouchableOpacity>
                    {fullScreenVideo && (
                        <Video
                            source={{ uri: fullScreenVideo }}
                            style={styles.fullScreenVideo}
                            resizeMode={ResizeMode.CONTAIN}
                            useNativeControls
                            shouldPlay
                            isLooping={false}
                        />
                    )}
                </View>
            </Modal>
        </GradientBackground>
    );
}

// Animated typing dot component
function TypingDot({ delay }: { delay: number }) {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 300 }),
                withTiming(0.4, { duration: 300 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.typingDot, animatedStyle, { marginLeft: delay > 0 ? 4 : 0 }]}>
            <LinearGradient
                colors={gradients.premiumGold as [string, string]}
                style={styles.typingDotGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
        </Animated.View>
    );
}

// Uploading skeleton component
function UploadingSkeleton({ uploadStatus }: { uploadStatus: UploadStatus }) {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
        );
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
    }));

    if (!uploadStatus) return null;

    const isVideo = uploadStatus.mediaType === 'video';
    const statusText = uploadStatus.status === 'compressing'
        ? 'Compressing video...'
        : `Uploading ${isVideo ? 'video' : 'image'}...`;

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.messageRow, styles.myMessageRow]}
        >
            <View style={styles.myBubbleContainer}>
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={[styles.bubble, styles.myBubble]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Silk highlight */}
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.15)', 'transparent']}
                        style={styles.bubbleSilkHighlight}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />

                    {/* Skeleton media placeholder */}
                    <Animated.View style={[styles.uploadingMediaSkeleton, shimmerStyle]}>
                        {uploadStatus.thumbnailUri && !isVideo ? (
                            <Image
                                source={{ uri: uploadStatus.thumbnailUri }}
                                style={styles.uploadingThumbnail}
                                blurRadius={10}
                            />
                        ) : (
                            <View style={styles.uploadingIconContainer}>
                                <Ionicons
                                    name={isVideo ? "videocam" : "image"}
                                    size={32}
                                    color={colors.textTertiary}
                                />
                            </View>
                        )}

                        {/* Overlay with spinner and status */}
                        <View style={styles.uploadingOverlay}>
                            <ActivityIndicator color={ACCENT} size="small" />
                            <Text style={styles.uploadingText}>{statusText}</Text>
                        </View>
                    </Animated.View>
                </LinearGradient>
            </View>
        </Animated.View>
    );
}

// Video player component with native-like tap behavior
function ChatVideoPlayer({
    signedUrl,
    storagePath,
    urlError,
    onFullScreen,
}: {
    signedUrl: string | null;
    storagePath: string;
    urlError: boolean;
    onFullScreen: (uri: string) => void;
}) {
    const videoRef = useRef<Video>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasEnded, setHasEnded] = useState(false); // Track if video reached the end
    const [cachedUri, setCachedUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for cached video on mount
    useEffect(() => {
        const checkCache = async () => {
            const cached = await getVideoCachedUri(getStoragePath(storagePath));
            if (cached) {
                setCachedUri(cached);
            }
        };
        checkCache();
    }, [storagePath]);

    // Handle playback status updates
    const handlePlaybackStatusUpdate = useCallback(async (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;

        setIsLoading(false);

        // Track playing state from status
        setIsPlaying(status.isPlaying);

        // Check if video has reached the end
        if (status.didJustFinish) {
            setHasEnded(true);
            setIsPlaying(false);

            // Cache in background if not already cached
            if (signedUrl && !cachedUri) {
                cacheVideo(getStoragePath(storagePath), signedUrl).then((uri) => {
                    if (uri) setCachedUri(uri);
                });
            }
        }
    }, [signedUrl, storagePath, cachedUri]);

    // Toggle play/pause with native-like behavior
    const handleTapToPlay = useCallback(async () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            // Pause mid-video
            await videoRef.current.pauseAsync();
            setIsPlaying(false);
        } else {
            // If video ended, restart from beginning
            if (hasEnded) {
                await videoRef.current.setPositionAsync(0);
                setHasEnded(false);
            }
            await videoRef.current.playAsync();
            setIsPlaying(true);

            // Start caching when playback starts
            if (signedUrl && !cachedUri) {
                cacheVideo(getStoragePath(storagePath), signedUrl).then((uri) => {
                    if (uri) setCachedUri(uri);
                });
            }
        }
    }, [isPlaying, hasEnded, signedUrl, storagePath, cachedUri]);

    // Handle full screen
    const handleFullScreen = useCallback(() => {
        const uri = cachedUri || signedUrl;
        if (uri) {
            // Pause current playback before going full screen
            if (videoRef.current && isPlaying) {
                videoRef.current.pauseAsync();
                setIsPlaying(false);
            }
            onFullScreen(uri);
        }
    }, [cachedUri, signedUrl, isPlaying, onFullScreen]);

    // Use cached URI if available, otherwise use signed URL
    const videoSource = cachedUri || signedUrl;

    if (urlError || !videoSource) {
        return (
            <View style={[styles.messageVideo, styles.messageMediaError]}>
                <Ionicons name="videocam-outline" size={32} color={colors.textSecondary} />
                <Text style={styles.messageImageErrorText}>Video unavailable</Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleTapToPlay}
            onLongPress={handleFullScreen}
            delayLongPress={300}
            style={styles.videoContainer}
        >
            <Video
                ref={videoRef}
                source={{ uri: videoSource }}
                style={styles.messageVideo}
                resizeMode={ResizeMode.COVER}
                isLooping={false}
                shouldPlay={false}
                positionMillis={0}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />

            {/* Loading indicator */}
            {isLoading && (
                <View style={styles.videoLoadingOverlay}>
                    <ActivityIndicator color={ACCENT} size="small" />
                </View>
            )}

            {/* Play/Replay overlay - only shows when paused or ended */}
            {!isPlaying && !isLoading && (
                <View style={styles.videoPlayOverlay}>
                    <LinearGradient
                        colors={gradients.premiumGold as [string, string]}
                        style={styles.videoPlayButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons
                            name={hasEnded ? "refresh" : "play"}
                            size={24}
                            color={colors.text}
                            style={hasEnded ? undefined : { marginLeft: 3 }}
                        />
                    </LinearGradient>
                </View>
            )}

            {/* Full screen button */}
            {!isPlaying && !isLoading && (
                <TouchableOpacity
                    style={styles.videoFullScreenButton}
                    onPress={handleFullScreen}
                    activeOpacity={0.7}
                >
                    <Ionicons name="expand-outline" size={16} color={colors.text} />
                </TouchableOpacity>
            )}

            {/* Cached indicator */}
            {cachedUri && !isPlaying && (
                <View style={styles.videoCachedBadge}>
                    <Ionicons name="download-outline" size={10} color={colors.textSecondary} />
                </View>
            )}
        </TouchableOpacity>
    );
}

function MessageContent({
    item,
    isMe,
    revealMessage,
    onImagePress,
    onVideoFullScreen,
}: {
    item: Message;
    isMe: boolean;
    revealMessage: (id: string) => void;
    onImagePress: (uri: string) => void;
    onVideoFullScreen: (uri: string) => void;
}) {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [urlError, setUrlError] = useState(false);

    useEffect(() => {
        if (!item.media_path) return;

        let isMounted = true;

        const fetchSignedUrl = async () => {
            const storagePath = getStoragePath(item.media_path!);
            const url = await getCachedSignedUrl(storagePath);

            if (!isMounted) return;

            if (url) {
                setSignedUrl(url);
            } else {
                setUrlError(true);
            }
        };

        fetchSignedUrl();

        return () => {
            isMounted = false;
        };
    }, [item.media_path]);

    // Handle expired videos
    const isExpired = !!(item as any).media_expired;
    const isVideo = (item as any).media_type === 'video';

    if (isExpired && isVideo) {
        return (
            <View>
                <View style={styles.expiredMedia}>
                    <LinearGradient
                        colors={['rgba(22, 33, 62, 0.8)', 'rgba(13, 13, 26, 0.9)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.expiredIconContainer}>
                        <Ionicons name="videocam-off-outline" size={28} color={colors.textTertiary} />
                    </View>
                    <Text style={styles.expiredText}>Video expired</Text>
                    <Text style={styles.expiredSubtext}>Videos are deleted 30 days after viewing</Text>
                </View>
                <MessageMeta item={item} isMe={isMe} />
            </View>
        );
    }

    // Handle media (images and videos)
    if (item.media_path || isExpired) {
        const isViewed = !!item.media_viewed_at;
        const canOpenFullScreen = (isMe || isViewed) && !isVideo; // Only images can go fullscreen

        // Video content
        if (isVideo) {
            return (
                <View>
                    {(!isMe && !isViewed) ? (
                        // Blurred placeholder with reveal overlay for unrevealed videos
                        <View>
                            <View style={[styles.messageVideo, styles.videoBlurred]}>
                                <LinearGradient
                                    colors={['rgba(22, 33, 62, 0.9)', 'rgba(13, 13, 26, 0.95)']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <Ionicons name="videocam" size={40} color={colors.textTertiary} />
                            </View>
                            <TouchableOpacity
                                style={styles.revealOverlay}
                                activeOpacity={0.8}
                                onPress={() => revealMessage(item.id)}
                            >
                                <View style={styles.revealContent}>
                                    <LinearGradient
                                        colors={gradients.premiumGold as [string, string]}
                                        style={styles.revealIconContainer}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons name="eye-off-outline" size={24} color={colors.text} />
                                    </LinearGradient>
                                    <Text style={styles.revealText}>Tap to reveal video</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    ) : signedUrl || urlError ? (
                        <ChatVideoPlayer
                            signedUrl={signedUrl}
                            storagePath={item.media_path!}
                            urlError={urlError}
                            onFullScreen={onVideoFullScreen}
                        />
                    ) : (
                        <View style={[styles.messageVideo, styles.messageImageLoading]}>
                            <ActivityIndicator color={ACCENT} />
                        </View>
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

        // Image content (existing logic)
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
                            cachePolicy="disk"
                            transition={200}
                        />
                    ) : urlError ? (
                        <View style={[styles.messageImage, styles.messageImageError]}>
                            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                            <Text style={styles.messageImageErrorText}>Image unavailable</Text>
                        </View>
                    ) : (
                        <View style={[styles.messageImage, styles.messageImageLoading]}>
                            <ActivityIndicator color={ACCENT} />
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
                            <LinearGradient
                                colors={gradients.premiumGold as [string, string]}
                                style={styles.revealIconContainer}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="eye-off-outline" size={24} color={colors.text} />
                            </LinearGradient>
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
            return <Ionicons name="checkmark-done" size={14} color={ACCENT} />;
        } else if (isDelivered) {
            // Double tick grey - delivered but not read
            return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.4)" />;
        } else {
            // Single tick grey - sent but not delivered
            return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.4)" />;
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
    onPickMedia,
    onTakePhoto,
    onRecordVideo,
}: {
    inputText: string;
    uploading: boolean;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onPickMedia: () => void;
    onTakePhoto: () => void;
    onRecordVideo: () => void;
}) {
    const [menuExpanded, setMenuExpanded] = useState(false);
    const menuWidth = useSharedValue(0);
    const buttonRotation = useSharedValue(0);

    const toggleMenu = () => {
        const newExpanded = !menuExpanded;
        setMenuExpanded(newExpanded);
        menuWidth.value = withTiming(newExpanded ? 132 : 0, { duration: 200, easing: Easing.out(Easing.ease) });
        buttonRotation.value = withTiming(newExpanded ? 45 : 0, { duration: 200, easing: Easing.out(Easing.ease) });
    };

    const handleMediaAction = (action: () => void) => {
        setMenuExpanded(false);
        menuWidth.value = withTiming(0, { duration: 150 });
        buttonRotation.value = withTiming(0, { duration: 150 });
        action();
    };

    const menuAnimatedStyle = useAnimatedStyle(() => ({
        width: menuWidth.value,
        opacity: interpolate(menuWidth.value, [0, 132], [0, 1]),
    }));

    const plusButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${buttonRotation.value}deg` }],
    }));

    return (
        <View style={styles.inputContainer}>
            {/* Plus button to toggle media menu */}
            <TouchableOpacity onPress={toggleMenu} disabled={uploading} style={styles.attachButton}>
                {uploading ? (
                    <ActivityIndicator color={ACCENT} size="small" />
                ) : (
                    <Animated.View style={[styles.attachButtonInner, styles.plusButton, plusButtonAnimatedStyle]}>
                        <Ionicons name="add" size={24} color={ACCENT} />
                    </Animated.View>
                )}
            </TouchableOpacity>

            {/* Expandable media options */}
            <Animated.View style={[styles.mediaMenuContainer, menuAnimatedStyle]}>
                <TouchableOpacity
                    onPress={() => handleMediaAction(onTakePhoto)}
                    style={styles.mediaMenuItem}
                    activeOpacity={0.7}
                >
                    <View style={styles.mediaMenuItemInner}>
                        <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleMediaAction(onRecordVideo)}
                    style={styles.mediaMenuItem}
                    activeOpacity={0.7}
                >
                    <View style={styles.mediaMenuItemInner}>
                        <Ionicons name="videocam-outline" size={20} color={colors.textSecondary} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleMediaAction(onPickMedia)}
                    style={styles.mediaMenuItem}
                    activeOpacity={0.7}
                >
                    <View style={styles.mediaMenuItemInner}>
                        <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                    </View>
                </TouchableOpacity>
            </Animated.View>

            <View style={styles.inputFieldWrapper}>
                {/* Subtle gradient border effect */}
                <View style={styles.inputFieldBorder} />
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
                    colors={inputText.trim() ? gradients.primary as [string, string] : ['rgba(22, 33, 62, 0.6)', 'rgba(22, 33, 62, 0.6)']}
                    style={styles.sendButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Silk highlight */}
                    {inputText.trim() && (
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.2)', 'transparent']}
                            style={styles.sendButtonHighlight}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                    )}
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
    // Ambient orbs
    ambientOrb: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
    },
    orbTopRight: {
        top: 80,
        right: -60,
    },
    orbBottomLeft: {
        bottom: 200,
        left: -60,
    },
    orbGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 140,
    },
    // Premium Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        overflow: 'hidden',
    },
    headerSilkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.2)`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    headerAvatarContainer: {
        position: 'relative',
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarRing: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: `${ACCENT_RGBA}0.3)`,
    },
    headerAvatarGradient: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    headerTextContainer: {
        alignItems: 'flex-start',
    },
    headerLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: ACCENT,
        opacity: 0.8,
    },
    headerTitle: {
        ...typography.headline,
        color: colors.text,
    },
    headerSpacer: {
        width: 40,
    },
    headerBorderBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: `${ACCENT_RGBA}0.15)`,
    },
    // Premium Match Card
    matchCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
        borderRadius: radius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        overflow: 'hidden',
    },
    matchCardGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    matchLabel: {
        ...typography.caption2,
        fontWeight: '700',
        letterSpacing: 2,
        color: colors.premium.rose,
        marginBottom: spacing.xs,
    },
    matchLabelYesYes: {
        color: ACCENT,
    },
    matchSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
        width: 100,
    },
    matchSeparatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: `rgba(232, 164, 174, 0.3)`,
    },
    matchSeparatorLineYesYes: {
        backgroundColor: `${ACCENT_RGBA}0.3)`,
    },
    matchSeparatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: colors.premium.rose,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.sm,
        opacity: 0.7,
    },
    matchSeparatorDiamondYesYes: {
        backgroundColor: ACCENT,
    },
    matchQuestionText: {
        ...typography.subhead,
        color: colors.text,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    matchQuestionPartnerText: {
        ...typography.caption1,
        color: colors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 2,
    },
    responsePillsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    responsePillWrapper: {
        overflow: 'hidden',
        borderRadius: radius.full,
    },
    responsePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        gap: 4,
    },
    responsePillText: {
        ...typography.caption2,
        fontWeight: '600',
        color: colors.text,
    },
    responsePillMaybe: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        gap: 4,
        backgroundColor: `rgba(243, 156, 18, 0.15)`,
        borderWidth: 1,
        borderColor: `rgba(243, 156, 18, 0.3)`,
        borderRadius: radius.full,
    },
    responsePillTextMaybe: {
        ...typography.caption2,
        fontWeight: '600',
        color: colors.warning,
    },
    matchCardBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: `rgba(232, 164, 174, 0.2)`,
    },
    matchCardBorderYesYes: {
        borderColor: `${ACCENT_RGBA}0.25)`,
    },
    // Messages List
    messageList: {
        flex: 1,
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
    myBubbleContainer: {
        maxWidth: "78%",
    },
    theirBubbleContainer: {
        maxWidth: "78%",
    },
    bubble: {
        padding: spacing.md,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    myBubble: {
        borderBottomRightRadius: radius.xs,
    },
    theirBubble: {
        borderBottomLeftRadius: radius.xs,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.1)`,
    },
    bubbleSilkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 30,
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
    messageImageError: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
    },
    messageImageErrorText: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
    messageImageLoading: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Uploading skeleton styles
    uploadingMediaSkeleton: {
        width: 200,
        height: 150,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingThumbnail: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radius.md,
    },
    uploadingIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radius.md,
    },
    uploadingText: {
        ...typography.caption1,
        color: colors.text,
        marginTop: spacing.sm,
        fontWeight: '600',
    },
    // Video styles
    messageVideo: {
        width: 200,
        height: 200,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
        overflow: 'hidden',
    },
    videoContainer: {
        position: 'relative',
        width: 200,
        height: 200,
        borderRadius: radius.md,
        overflow: 'hidden',
    },
    videoBlurred: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    videoPlayButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoCachedBadge: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoFullScreenButton: {
        position: 'absolute',
        bottom: spacing.sm,
        right: spacing.sm,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    messageMediaError: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
    },
    // Expired video placeholder
    expiredMedia: {
        width: 200,
        height: 150,
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    expiredIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    expiredText: {
        ...typography.subhead,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    expiredSubtext: {
        ...typography.caption2,
        color: colors.textTertiary,
        marginTop: 2,
        textAlign: 'center',
        paddingHorizontal: spacing.sm,
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
    // Empty State
    emptyChat: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.2)`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptySeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        width: 100,
    },
    emptySeparatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: `${ACCENT_RGBA}0.3)`,
    },
    emptySeparatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: ACCENT,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.sm,
        opacity: 0.6,
    },
    emptyChatTitle: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptyChatSubtitle: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    // Input Area
    inputWrapper: {
        overflow: 'hidden',
    },
    inputWrapperBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: `${ACCENT_RGBA}0.15)`,
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    attachButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(22, 33, 62, 0.6)',
        borderWidth: 1,
        borderColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusButton: {
        borderColor: `${ACCENT_RGBA}0.3)`,
        backgroundColor: `${ACCENT_RGBA}0.1)`,
    },
    mediaMenuContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        gap: 4,
    },
    mediaMenuItem: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaMenuItemInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(22, 33, 62, 0.6)',
        borderWidth: 1,
        borderColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputFieldWrapper: {
        flex: 1,
        backgroundColor: 'rgba(22, 33, 62, 0.5)',
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    inputFieldBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: "center",
        alignItems: "center",
        overflow: 'hidden',
    },
    sendButtonHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 20,
    },
    // Typing Indicator
    typingContainer: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    typingBubble: {
        borderRadius: radius.lg,
        borderBottomLeftRadius: radius.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        alignSelf: 'flex-start',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.1)`,
    },
    typingDots: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 20,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    typingDotGradient: {
        width: '100%',
        height: '100%',
    },
    // Reveal Overlay
    revealOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: radius.md,
    },
    revealContent: {
        alignItems: "center",
    },
    revealIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    revealText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: "600",
    },
    // Full Screen Modal
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
        zIndex: 10,
    },
    fullScreenCloseGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenImage: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height * 0.8,
    },
    fullScreenVideo: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height * 0.8,
    },
    fullScreenSpinner: {
        position: "absolute",
    },
});
