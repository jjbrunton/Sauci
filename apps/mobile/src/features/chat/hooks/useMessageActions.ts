/**
 * useMessageActions - Hook for message deletion actions
 * Handles "delete for self" and "delete for everyone" functionality.
 */
import { Platform, ActionSheetIOS, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../lib/supabase';
import type { Message } from '../types';

interface UseMessageActionsConfig {
    userId: string | undefined;
}

export function useMessageActions({ userId }: UseMessageActionsConfig) {
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
     * Show delete options for a message.
     * Author gets both options, non-author only gets "delete for me".
     */
    const showDeleteOptions = (message: Message, isMe: boolean) => {
        // Don't show options for already deleted messages
        if (message.deleted_at) return;

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (Platform.OS === 'ios') {
            const options = ['Cancel', 'Delete for me'];
            if (isMe) options.push('Delete for everyone');

            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    destructiveButtonIndex: isMe ? 2 : 1,
                    cancelButtonIndex: 0,
                    title: 'Delete message?',
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        deleteForSelf(message.id);
                    } else if (buttonIndex === 2 && isMe) {
                        deleteForEveryone(message.id);
                    }
                }
            );
        } else {
            // Android fallback using Alert
            const buttons: Array<{ text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }> = [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete for me',
                    style: 'destructive',
                    onPress: () => deleteForSelf(message.id),
                },
            ];

            if (isMe) {
                buttons.push({
                    text: 'Delete for everyone',
                    style: 'destructive',
                    onPress: () => deleteForEveryone(message.id),
                });
            }

            Alert.alert('Delete message?', undefined, buttons);
        }
    };

    return { showDeleteOptions, deleteForSelf, deleteForEveryone };
}
