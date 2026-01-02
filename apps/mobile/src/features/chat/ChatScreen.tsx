import { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Dimensions, Alert } from "react-native";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, useAnimatedStyle } from "react-native-reanimated";

import { InputBar, ChatHeader, ChatMessages } from "./components";
import { useMediaUpload } from "./hooks/useMediaUpload";
import { useMessageActions } from "./hooks/useMessageActions";

import { supabase } from "../../lib/supabase";
import { useAuthStore, useMessageStore } from "../../store";
import { useAmbientOrbAnimation, useMediaPicker, useTypingIndicator, useMessageSubscription, useEncryptedSend, useMediaSaver } from "../../hooks";
import { Database } from "../../types/supabase";
import { GradientBackground } from "../../components/ui";
import { colors, gradients, spacing } from "../../theme";
import { Events } from "../../lib/analytics";

type Message = Database["public"]["Tables"]["messages"]["Row"];

// Premium color palette for Chat
const ACCENT = colors.premium.gold;
const ROSE_RGBA = 'rgba(232, 164, 174, ';
const ACCENT_RGBA = 'rgba(212, 175, 55, ';

export const ChatScreen: React.FC = () => {
    const { id } = useLocalSearchParams();
    const matchId = id as string;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, partner } = useAuthStore();
    const { setActiveMatchId, markMatchMessagesAsRead } = useMessageStore();
    const [match, setMatch] = useState<any>(null);
    const [inputText, setInputText] = useState("");
    const { uploading, uploadStatus, uploadMedia } = useMediaUpload(matchId, user?.id);
    const { saveMedia, saving: mediaSaving } = useMediaSaver();
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [fullScreenImageLoading, setFullScreenImageLoading] = useState(true);
    const [fullScreenVideo, setFullScreenVideo] = useState<string | null>(null);

    // Ambient orb breathing animations
    const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation({
        opacityRange1: [0.2, 0.4],
        opacityRange2: [0.15, 0.35],
    });

    // Media picker hook
    const { pickMedia, takePhoto, recordVideo } = useMediaPicker({
        imageQuality: 0.7,
        libraryVideoMaxDuration: 300, // 5 min max
        cameraVideoMaxDuration: 60,   // 1 min for camera recording
    });

    // Typing indicator hook
    const { partnerTyping, sendTypingEvent, clearTypingIndicator } = useTypingIndicator({
        channelName: `chat:${matchId}`,
        userId: user?.id,
    });

    // Message subscription hook
    const { messages, setMessages, isFocusedRef } = useMessageSubscription({
        matchId,
        userId: user?.id,
        onNewMessage: clearTypingIndicator,
    });

    // E2EE encryption hook for sending messages
    const { encryptMessage, isE2EEAvailable } = useEncryptedSend();

    // Message actions hook for deletion
    const { showDeleteOptions } = useMessageActions({ userId: user?.id });

    // Handle long press on message to show delete options
    const handleMessageLongPress = useCallback((message: Message, isMe: boolean) => {
        // Don't show options for already deleted messages
        if (message.deleted_at) return;
        showDeleteOptions(message, isMe);
    }, [showDeleteOptions]);

    // Track active chat to prevent notifications for current chat
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
    }, [matchId]);

    const handleTyping = (text: string) => {
        setInputText(text);

        if (text.length > 0) {
            sendTypingEvent();
        }
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;
        if (!user) return;

        const content = inputText.trim();
        setInputText("");

        try {
            // Try to encrypt the message if E2EE is available
            console.log(`[E2EE Send] isE2EEAvailable=${isE2EEAvailable}`);
            const encryptedPayload = isE2EEAvailable ? await encryptMessage(content) : null;
            console.log(`[E2EE Send] encryptedPayload=`, encryptedPayload ? {
                version: encryptedPayload.version,
                encrypted_content_length: encryptedPayload.encrypted_content.length,
                encryption_iv_length: encryptedPayload.encryption_iv.length,
                keys_metadata: encryptedPayload.keys_metadata,
            } : null);

            if (encryptedPayload) {
                // Send encrypted message (v2)
                const { error, data } = await supabase.from("messages").insert({
                    match_id: matchId,
                    user_id: user.id,
                    content: null,
                    version: encryptedPayload.version,
                    encrypted_content: encryptedPayload.encrypted_content,
                    encryption_iv: encryptedPayload.encryption_iv,
                    keys_metadata: encryptedPayload.keys_metadata as unknown as Record<string, unknown>,
                }).select();
                
                console.log(`[E2EE Send] Insert result:`, { error, data });

                if (error) {
                    Alert.alert("Error", "Failed to send message");
                    setInputText(content);
                } else {
                    Events.messageSent();
                }
            } else {
                // Fallback to plaintext (v1) if E2EE not available
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
            }
        } catch (err) {
            console.error("Error sending message:", err);
            Alert.alert("Error", "Failed to send message");
            setInputText(content);
        }
    };

    const handlePickMedia = async () => {
        const result = await pickMedia();
        if (result) {
            uploadMedia(result.uri, result.mediaType);
        }
    };

    const handleTakePhoto = async () => {
        const result = await takePhoto();
        if (result) {
            uploadMedia(result.uri, 'image');
        }
    };

    const handleRecordVideo = async () => {
        const result = await recordVideo();
        if (result) {
            uploadMedia(result.uri, 'video');
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

    return (
        <GradientBackground>
            {/* Ambient Orbs */}
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

                <ChatHeader
                    partner={partner}
                    user={user}
                    match={match}
                    insets={insets}
                    onBack={() => router.back()}
                />

                <ChatMessages
                    messages={messages}
                    userId={user?.id}
                    uploadStatus={uploadStatus}
                    partnerTyping={partnerTyping}
                    onImagePress={setFullScreenImage}
                    onVideoFullScreen={setFullScreenVideo}
                    revealMessage={revealMessage}
                    onMessageLongPress={handleMessageLongPress}
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
                        style={styles.fullScreenSaveButton}
                        onPress={() => fullScreenImage && saveMedia(fullScreenImage, 'image')}
                        activeOpacity={0.8}
                        disabled={mediaSaving}
                    >
                        <LinearGradient
                            colors={gradients.premiumGold as [string, string]}
                            style={styles.fullScreenCloseGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {mediaSaving ? (
                                <ActivityIndicator size="small" color={colors.text} />
                            ) : (
                                <Ionicons name="download-outline" size={24} color={colors.text} />
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

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
                        style={styles.fullScreenSaveButton}
                        onPress={() => fullScreenVideo && saveMedia(fullScreenVideo, 'video')}
                        activeOpacity={0.8}
                        disabled={mediaSaving}
                    >
                        <LinearGradient
                            colors={gradients.premiumGold as [string, string]}
                            style={styles.fullScreenCloseGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {mediaSaving ? (
                                <ActivityIndicator size="small" color={colors.text} />
                            ) : (
                                <Ionicons name="download-outline" size={24} color={colors.text} />
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

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
};

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
    fullScreenSaveButton: {
        position: "absolute",
        top: 50,
        left: 20,
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
});
