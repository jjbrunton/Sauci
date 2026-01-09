import React, { useRef, useCallback, useMemo } from 'react';
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
import { UploadStatus, Match } from '../types';

type Message = Database['public']['Tables']['messages']['Row'];

interface ChatMessagesProps {
    messages: Message[];
    userId: string | undefined;
    match: Match | null;
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

const ChatMessagesComponent: React.FC<ChatMessagesProps> = ({
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

    // Memoize keyExtractor to prevent recreation
    const keyExtractor = useCallback((item: Message) => item.id, []);

    // Memoize user object for MatchCard to prevent re-renders
    const userObject = useMemo(() => ({ id: userId || '' }), [userId]);

    // Memoize renderMessage to prevent recreation on every render
    const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
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
            <View>
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
            </View>
        );
    }, [messages, userId, onMessageLongPress, revealMessage, onImagePress, onVideoFullScreen]);

    // Memoize ListHeaderComponent to prevent recreation
    const listHeaderComponent = useMemo(() => (
        <View>
            {uploadStatus && <UploadProgress uploadStatus={uploadStatus} />}
            {partnerTyping && <TypingIndicator />}
        </View>
    ), [uploadStatus, partnerTyping]);

    // Memoize ListFooterComponent to prevent recreation
    const listFooterComponent = useMemo(() => (
        <View style={styles.footerContainer}>
            <MatchCard match={match} user={userObject} />
        </View>
    ), [match, userObject]);

    // Memoize ListEmptyComponent to prevent recreation
    const listEmptyComponent = useMemo(() => (
        <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            style={styles.emptyChat}
        >
            <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={32} color={ACCENT} />
            </View>
            <DecorativeSeparator variant="gold" width={100} marginVertical={spacing.md} />
            <Text style={styles.emptyChatTitle}>Start the Conversation</Text>
            <Text style={styles.emptyChatSubtitle}>
                Share your thoughts about this match
            </Text>
        </Animated.View>
    ), []);

    return (
        <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            inverted
            style={styles.messageList}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={15}
            windowSize={10}
            initialNumToRender={20}
            ListHeaderComponent={listHeaderComponent}
            ListFooterComponent={listFooterComponent}
            ListEmptyComponent={listEmptyComponent}
        />
    );
};

// Wrap with React.memo for performance
export const ChatMessages = React.memo(ChatMessagesComponent);

const styles = StyleSheet.create({
    messageList: {
        flex: 1,
    },
    listContent: {
        flexGrow: 1,
        padding: spacing.md,
    },
    footerContainer: {
        paddingBottom: spacing.md,
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
