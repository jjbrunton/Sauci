import React, { useRef } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MessageBubble } from './MessageBubble';
import { MessageContent } from './MessageContent';
import { DateSeparator } from './DateSeparator';
import { UploadProgress } from './UploadProgress';
import { TypingIndicator } from './TypingIndicator';
import { MatchCard } from './MatchCard';
import { DecorativeSeparator } from '../../../components/ui';
import { colors, spacing, typography } from '../../../theme';
import { Database } from '../../../types/supabase';
import { UploadStatus } from '../types';

type Message = Database['public']['Tables']['messages']['Row'];

interface ChatMessagesProps {
    messages: Message[];
    userId: string | undefined;
    match: any;
    uploadStatus: UploadStatus | null;
    partnerTyping: boolean;
    onImagePress: (uri: string) => void;
    onVideoFullScreen: (uri: string) => void;
    revealMessage: (messageId: string) => void;
    /** Called when a message bubble is long pressed */
    onMessageLongPress: (message: Message, isMe: boolean) => void;
}

const ACCENT = colors.premium.gold;
const ACCENT_RGBA = 'rgba(212, 175, 55, ';

/**
 * Check if two dates are on the same calendar day
 */
function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
    messages,
    userId,
    match,
    uploadStatus,
    partnerTyping,
    onImagePress,
    onVideoFullScreen,
    revealMessage,
    onMessageLongPress,
}) => {
    const flatListRef = useRef<FlatList>(null);

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isMe = item.user_id === userId;
        const messageDate = new Date(item.created_at!);

        // Determine if we should show a date separator above this message
        // In an inverted list, index 0 is newest (bottom), higher indices are older (top)
        // Show separator when this message's date differs from the next (older) message
        const nextMessage = messages[index + 1];
        const showDateSeparator = !nextMessage || (
            nextMessage.created_at &&
            !isSameDay(messageDate, new Date(nextMessage.created_at))
        );

        return (
            <>
                <MessageBubble
                    isMe={isMe}
                    index={index}
                    onLongPress={() => onMessageLongPress(item, isMe)}
                >
                    <MessageContent
                        item={item}
                        isMe={isMe}
                        currentUserId={userId || ''}
                        revealMessage={revealMessage}
                        onImagePress={onImagePress}
                        onVideoFullScreen={onVideoFullScreen}
                    />
                </MessageBubble>
                {showDateSeparator && <DateSeparator date={messageDate} />}
            </>
        );
    };

    return (
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
                    {/* Show uploading status when media is being uploaded */}
                    {uploadStatus && <UploadProgress uploadStatus={uploadStatus} />}

                    {/* Show typing indicator when partner is typing */}
                    {partnerTyping && <TypingIndicator />}
                </>
            }
            ListFooterComponent={
                <View style={{ paddingBottom: spacing.md }}>
                    <MatchCard match={match} user={{ id: userId || '' }} />
                </View>
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
                    <DecorativeSeparator variant="gold" width={100} marginVertical={spacing.md} />

                    <Text style={styles.emptyChatTitle}>Start the Conversation</Text>
                    <Text style={styles.emptyChatSubtitle}>
                        Share your thoughts about this match
                    </Text>
                </Animated.View>
            }
        />
    );
};

const styles = StyleSheet.create({
    messageList: {
        flex: 1,
    },
    listContent: {
        flexGrow: 1,
        padding: spacing.md,
    },
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
    emptyChatTitle: {
        ...typography.headline,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptyChatSubtitle: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
});
