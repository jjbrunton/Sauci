/**
 * useMessageActions - Hook for message actions
 * Handles "delete for self", "delete for everyone", and "report" functionality.
 */
import { Platform, ActionSheetIOS, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../lib/supabase';
import type { Message } from '../types';

interface UseMessageActionsConfig {
    userId: string | undefined;
    onReport?: (message: Message) => void;
}

export function useMessageActions({ userId, onReport }: UseMessageActionsConfig) {
    /**
     * Delete a message for the current user only.
     * Message will still be visible to the partner.
     */
    const deleteForSelf = async (messageId: string) => {
        if (!userId) return;

        const { error } = await supabase
            .from('message_deletions')
            .insert({ message_id: messageId, user_id: userId });

        if (error) {
            Alert.alert('Error', 'Failed to delete message');
            console.error('Delete for self error:', error);
        }
    };

    /**
     * Delete a message for everyone (author only).
     * Message will show as "deleted" to both users.
     */
    const deleteForEveryone = async (messageId: string) => {
        const { error } = await supabase
            .from('messages')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', messageId);

        if (error) {
            Alert.alert('Error', 'Failed to delete message');
            console.error('Delete for everyone error:', error);
        }
    };

    /**
     * Show options for a message.
     * Author gets delete options, non-author gets delete for me + report.
     */
    const showDeleteOptions = (message: Message, isMe: boolean) => {
        // Don't show options for already deleted messages
        if (message.deleted_at) return;

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (Platform.OS === 'ios') {
            if (isMe) {
                // Author sees: Cancel, Delete for me, Delete for everyone
                const options = ['Cancel', 'Delete for me', 'Delete for everyone'];
                ActionSheetIOS.showActionSheetWithOptions(
                    {
                        options,
                        destructiveButtonIndex: 2,
                        cancelButtonIndex: 0,
                        title: 'Delete message?',
                    },
                    (buttonIndex) => {
                        if (buttonIndex === 1) {
                            deleteForSelf(message.id);
                        } else if (buttonIndex === 2) {
                            deleteForEveryone(message.id);
                        }
                    }
                );
            } else {
                // Non-author sees: Cancel, Delete for me, Report
                const options = ['Cancel', 'Delete for me', 'Report'];
                ActionSheetIOS.showActionSheetWithOptions(
                    {
                        options,
                        destructiveButtonIndex: 2,
                        cancelButtonIndex: 0,
                        title: 'Message options',
                    },
                    (buttonIndex) => {
                        if (buttonIndex === 1) {
                            deleteForSelf(message.id);
                        } else if (buttonIndex === 2 && onReport) {
                            onReport(message);
                        }
                    }
                );
            }
        } else {
            // Android fallback using Alert
            if (isMe) {
                Alert.alert('Delete message?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete for me',
                        style: 'destructive',
                        onPress: () => deleteForSelf(message.id),
                    },
                    {
                        text: 'Delete for everyone',
                        style: 'destructive',
                        onPress: () => deleteForEveryone(message.id),
                    },
                ]);
            } else {
                Alert.alert('Message options', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete for me',
                        onPress: () => deleteForSelf(message.id),
                    },
                    {
                        text: 'Report',
                        style: 'destructive',
                        onPress: () => onReport?.(message),
                    },
                ]);
            }
        }
    };

    return { showDeleteOptions, deleteForSelf, deleteForEveryone };
}
