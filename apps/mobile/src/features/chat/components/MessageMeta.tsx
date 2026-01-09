import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ReadReceipt, getReceiptStatus } from '../../../components/ui';
import { colors, typography, spacing } from '../../../theme';
import { Message } from '../types';

export interface MessageMetaProps {
    item: Message;
    isMe: boolean;
}

/**
 * Message metadata component showing timestamp and read receipts.
 */
const MessageMetaComponent: React.FC<MessageMetaProps> = ({ item, isMe }) => {
    const status = getReceiptStatus(item.delivered_at, item.read_at);

    return (
        <View style={styles.container}>
            <Text style={styles.timestamp}>
                {new Date(item.created_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
                <View style={styles.readStatus}>
                    <ReadReceipt status={status} />
                </View>
            )}
        </View>
    );
};

// Wrap with React.memo for performance
export const MessageMeta = React.memo(MessageMetaComponent);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    timestamp: {
        ...typography.caption2,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    readStatus: {
        marginLeft: spacing.xs,
    },
});
