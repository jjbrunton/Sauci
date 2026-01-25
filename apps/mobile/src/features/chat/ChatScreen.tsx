import { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { InputBar, ChatHeader, ChatMessages, ReportMessageSheet, ChatSettingsSheet, FullScreenImageModal, FullScreenVideoModal } from "./components";
import { useMediaUpload } from "./hooks/useMediaUpload";
import { useMessageActions } from "./hooks/useMessageActions";
import type { ReportReason, Match } from "./types";

import { supabase } from "../../lib/supabase";
import { useAuthStore, useMessageStore, useMatchStore } from "../../store";
import { useAmbientOrbAnimation, useMediaPicker, useTypingIndicator, useMessageSubscription, useMediaSaver } from "../../hooks";
import { Database } from "../../types/supabase";
import { GradientBackground } from "../../components/ui";
import { colors, gradients, radius, spacing, typography } from "../../theme";
import { Events } from "../../lib/analytics";

type Message = Database["public"]["Tables"]["messages"]["Row"];

// Premium color palette for Chat
const ROSE_RGBA = 'rgba(232, 164, 174, ';
const ACCENT_RGBA = 'rgba(212, 175, 55, ';

export const ChatScreen: React.FC = () => {
    const { id } = useLocalSearchParams();
    const matchId = id as string;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, partner } = useAuthStore();
    const { setActiveMatchId, markMatchMessagesAsRead } = useMessageStore();
    const { archiveMatch, unarchiveMatch, isMatchArchived } = useMatchStore();
    const [match, setMatch] = useState<Match | null>(null);
    const [inputText, setInputText] = useState("");
    const [showSettingsSheet, setShowSettingsSheet] = useState(false);
    const { uploading, uploadStatus, uploadMedia } = useMediaUpload(matchId, user?.id);
    const { saveMedia, saving: mediaSaving } = useMediaSaver();
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [fullScreenImageLoading, setFullScreenImageLoading] = useState(true);
    const [fullScreenVideo, setFullScreenVideo] = useState<string | null>(null);
    const [reportingMessage, setReportingMessage] = useState<Message | null>(null);

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

    const isFocused = useIsFocused();

    // Typing indicator hook
    const { partnerTyping, sendTypingEvent, clearTypingIndicator } = useTypingIndicator({
        channelName: `chat:${matchId}`,
        userId: user?.id,
        isFocused,
    });

    // Message subscription hook
    const { messages, setMessages, isFocusedRef } = useMessageSubscription({
        matchId,
        userId: user?.id,
        onNewMessage: clearTypingIndicator,
    });


    // Message actions hook for deletion and reporting
    const { showDeleteOptions, deleteForSelf } = useMessageActions({
        userId: user?.id,
        onReport: (message) => setReportingMessage(message),
    });

    // Memoized navigation callbacks
    const handleBack = useCallback(() => {
        router.push('/(app)/matches');
    }, [router]);

    const handleOpenSettings = useCallback(() => {
        setShowSettingsSheet(true);
    }, []);

    const handleCloseSettings = useCallback(() => {
        setShowSettingsSheet(false);
    }, []);

    // Memoized modal callbacks
    const handleCloseImage = useCallback(() => {
        setFullScreenImage(null);
    }, []);

    const handleSaveImage = useCallback(() => {
        if (fullScreenImage) {
            saveMedia(fullScreenImage, 'image');
        }
    }, [fullScreenImage, saveMedia]);

    const handleImageLoadStart = useCallback(() => {
        setFullScreenImageLoading(true);
    }, []);

    const handleImageLoadEnd = useCallback(() => {
        setFullScreenImageLoading(false);
    }, []);

    const handleCloseVideo = useCallback(() => {
        setFullScreenVideo(null);
    }, []);

    const handleSaveVideo = useCallback(() => {
        if (fullScreenVideo) {
            saveMedia(fullScreenVideo, 'video');
        }
    }, [fullScreenVideo, saveMedia]);

    const handleCloseReport = useCallback(() => {
        setReportingMessage(null);
    }, []);

    // Memoized archive/unarchive callbacks
    const handleArchive = useCallback(async () => {
        await archiveMatch(matchId);
        router.push('/(app)/matches');
    }, [archiveMatch, matchId, router]);

    const handleUnarchive = useCallback(async () => {
        await unarchiveMatch(matchId);
    }, [unarchiveMatch, matchId]);

    // Handle long press on message to show options
    const handleMessageLongPress = useCallback((message: Message, isMe: boolean) => {
        // Don't show options for already deleted messages
        if (message.deleted_at) return;
        showDeleteOptions(message, isMe);
    }, [showDeleteOptions]);

    // Handle report submission
    const handleSubmitReport = useCallback(async (reason: ReportReason) => {
        if (!reportingMessage || !user?.id) return;

        try {
            // Insert the report
            const { error: reportError } = await supabase
                .from('message_reports')
                .insert({
                    message_id: reportingMessage.id,
                    reporter_id: user.id,
                    reason: reason,
                });

            if (reportError) {
                if (reportError.code === '23505') {
                    // Unique violation - already reported
                    Alert.alert('Already Reported', 'You have already reported this message.');
                } else {
                    console.error('Report error:', reportError);
                    Alert.alert('Error', 'Failed to submit report');
                }
                setReportingMessage(null);
                return;
            }

            // Also delete the message for the reporter (so they don't see it anymore)
            await deleteForSelf(reportingMessage.id);

            // Remove from local state
            setMessages(prev => prev.filter(m => m.id !== reportingMessage.id));

            Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
            setReportingMessage(null);
        } catch (err) {
            console.error('Report error:', err);
            Alert.alert('Error', 'Failed to submit report');
            setReportingMessage(null);
        }
    }, [reportingMessage, user?.id, deleteForSelf, setMessages]);

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
            setMatch(null); // Clear previous match data immediately
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

    const handleTyping = useCallback((text: string) => {
        setInputText(text);

        if (text.length > 0) {
            sendTypingEvent();
        }
    }, [sendTypingEvent]);

    const handleSend = useCallback(async () => {
        if (!inputText.trim()) return;
        if (!user) return;

        const content = inputText.trim();
        setInputText("");

        try {
            // Send plaintext message (v1) - protected by TLS in transit and RLS policies
            const { error } = await supabase.from("messages").insert({
                match_id: matchId,
                user_id: user.id,
                content: content,
                version: 1,
            });

            if (error) {
                Alert.alert("Error", "Failed to send message");
                setInputText(content);
            } else {
                Events.messageSent();
            }
        } catch (err) {
            console.error("Error sending message:", err);
            Alert.alert("Delivery Failed", "Couldn't send message. Please check your connection.");
            setInputText(content);
        }
    }, [inputText, user, matchId]);

    const handlePickMedia = useCallback(async () => {
        const result = await pickMedia();
        if (result) {
            uploadMedia(result.uri, result.mediaType);
        }
    }, [pickMedia, uploadMedia]);

    const handleTakePhoto = useCallback(async () => {
        const result = await takePhoto();
        if (result) {
            uploadMedia(result.uri, 'image');
        }
    }, [takePhoto, uploadMedia]);

    const handleRecordVideo = useCallback(async () => {
        const result = await recordVideo();
        if (result) {
            uploadMedia(result.uri, 'video');
        }
    }, [recordVideo, uploadMedia]);

    const revealMessage = useCallback(async (messageId: string) => {
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
    }, [messages, setMessages]);

    return (
        <GradientBackground>
            {/* Ambient Orbs - Commented out for flat look
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
            */}

            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}
            >

                <ChatHeader
                    partner={partner}
                    insets={insets}
                    onBack={handleBack}
                    onSettingsPress={handleOpenSettings}
                />


                <ChatMessages
                    messages={messages}
                    userId={user?.id}
                    userName={user?.name ?? undefined}
                    partnerName={partner?.name ?? undefined}
                    match={match}
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
                    {/* Flat background */}
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundLight, borderTopWidth: 1, borderTopColor: colors.border }]} />
                    
                    {/* Gradient background - removed
                    <LinearGradient
                        colors={['rgba(22, 33, 62, 0.9)', 'rgba(13, 13, 26, 0.95)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />
                    */}
                    {/* Top border glow - removed
                    <View style={styles.inputWrapperBorder} />
                    */}

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
            <FullScreenImageModal
                uri={fullScreenImage}
                visible={!!fullScreenImage}
                loading={fullScreenImageLoading}
                saving={mediaSaving}
                onClose={handleCloseImage}
                onSave={handleSaveImage}
                onLoadStart={handleImageLoadStart}
                onLoadEnd={handleImageLoadEnd}
            />

            {/* Full Screen Video Modal */}
            <FullScreenVideoModal
                uri={fullScreenVideo}
                visible={!!fullScreenVideo}
                saving={mediaSaving}
                onClose={handleCloseVideo}
                onSave={handleSaveVideo}
            />

            {/* Report Message Sheet */}
            <ReportMessageSheet
                visible={reportingMessage !== null}
                onClose={handleCloseReport}
                onSubmit={handleSubmitReport}
            />

            {/* Chat Settings Sheet */}
            <ChatSettingsSheet
                visible={showSettingsSheet}
                onClose={handleCloseSettings}
                isArchived={isMatchArchived(matchId)}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
            />
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
