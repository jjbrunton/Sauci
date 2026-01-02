import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

export type ReceiptStatus = 'sent' | 'delivered' | 'read';

export interface ReadReceiptProps {
    /** Current status of the message */
    status: ReceiptStatus;
    /** Size of the icon */
    size?: number;
    /** Custom color for read state (default: gold accent) */
    readColor?: string;
    /** Custom color for unread states (default: muted white) */
    unreadColor?: string;
    /** Custom container style */
    style?: ViewStyle;
}

/**
 * Read receipt indicator component for messages.
 * Displays 3-state delivery status:
 * - Single tick (grey): sent to server
 * - Double tick (grey): delivered to partner's device
 * - Double tick (colored): read by partner
 */
export function ReadReceipt({
    status,
    size = 14,
    readColor = colors.info,
    unreadColor = 'rgba(255, 255, 255, 0.4)',
    style,
}: ReadReceiptProps) {
    const getIcon = () => {
        switch (status) {
            case 'read':
                // Double tick colored - read
                return (
                    <Ionicons
                        name="checkmark-done"
                        size={size}
                        color={readColor}
                    />
                );
            case 'delivered':
                // Double tick grey - delivered but not read
                return (
                    <Ionicons
                        name="checkmark-done"
                        size={size}
                        color={unreadColor}
                    />
                );
            case 'sent':
            default:
                // Single tick grey - sent but not delivered
                return (
                    <Ionicons
                        name="checkmark"
                        size={size}
                        color={unreadColor}
                    />
                );
        }
    };

    return (
        <View style={[styles.container, style]}>
            {getIcon()}
        </View>
    );
}

/**
 * Helper to derive receipt status from message timestamps.
 * Use this when you have raw delivered_at/read_at values.
 */
export function getReceiptStatus(
    deliveredAt: string | null | undefined,
    readAt: string | null | undefined
): ReceiptStatus {
    if (readAt) return 'read';
    if (deliveredAt) return 'delivered';
    return 'sent';
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ReadReceipt;
