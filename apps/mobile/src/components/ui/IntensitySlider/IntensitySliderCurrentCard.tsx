import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors } from '../../../theme';
import type { IntensityLevelConfig } from './constants';
import { styles } from './styles';

interface IntensitySliderCurrentCardProps {
    current: IntensityLevelConfig;
    levelsDiffer: boolean;
    userIsHigher: boolean;
    hasPartner: boolean;
    partnerAvatar?: string | null;
    mismatchMessage: string | null;
    onShowInfo: () => void;
}

export function IntensitySliderCurrentCard({
    current,
    levelsDiffer,
    userIsHigher,
    hasPartner,
    partnerAvatar,
    mismatchMessage,
    onShowInfo,
}: IntensitySliderCurrentCardProps) {
    return (
        <View style={[styles.currentCard, levelsDiffer && userIsHigher && styles.currentCardWarning]}>
            <View style={styles.currentHeader}>
                <Text style={styles.currentEmoji}>{current.emoji}</Text>
                <Text style={styles.currentLabel}>{current.label}</Text>
                {hasPartner && !levelsDiffer && (
                    <Pressable
                        style={styles.matchBadge}
                        onPress={onShowInfo}
                    >
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={styles.matchBadgeText}>Matched</Text>
                        <Ionicons name="information-circle-outline" size={12} color={colors.success} style={{ marginLeft: 2 }} />
                    </Pressable>
                )}
            </View>
            <Text style={styles.currentDescription}>{current.description}</Text>

            {levelsDiffer && mismatchMessage && (
                <Pressable
                    style={styles.mismatchRow}
                    onPress={onShowInfo}
                >
                    {partnerAvatar ? (
                        <Image
                            source={{ uri: partnerAvatar }}
                            style={styles.partnerAvatarTiny}
                            cachePolicy="memory-disk"
                            contentFit="cover"
                            transition={150}
                        />
                    ) : (
                        <View style={styles.partnerIconTiny}>
                            <Ionicons name="person" size={10} color={colors.secondary} />
                        </View>
                    )}
                    <Text style={[
                        styles.mismatchText,
                        userIsHigher && styles.mismatchTextWarning,
                    ]}>
                        {mismatchMessage}
                    </Text>
                    <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={userIsHigher ? colors.warning : colors.textSecondary}
                    />
                </Pressable>
            )}
        </View>
    );
}
