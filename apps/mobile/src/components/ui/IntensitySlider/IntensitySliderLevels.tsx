import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { IntensityLevel } from '@/types';
import { colors } from '../../../theme';
import { HEAT_COLORS, INTENSITY_LEVELS } from './constants';
import { styles } from './styles';

interface IntensitySliderLevelsProps {
    value: IntensityLevel;
    disabled: boolean;
    partnerValue?: IntensityLevel | null;
    partnerAvatar?: string | null;
    onSelect: (value: IntensityLevel) => void;
}

export function IntensitySliderLevels({
    value,
    disabled,
    partnerValue,
    partnerAvatar,
    onSelect,
}: IntensitySliderLevelsProps) {
    const hasPartner = partnerValue != null;

    return (
        <View style={styles.levelsRow}>
            {INTENSITY_LEVELS.map((level) => {
                const isSelected = value === level.level;
                const isPassed = value > level.level;
                const isActive = isSelected || isPassed;
                const isPartnerLevel = hasPartner && partnerValue === level.level;

                return (
                    <Pressable
                        key={level.level}
                        style={styles.levelButton}
                        onPress={() => onSelect(level.level)}
                        disabled={disabled}
                    >
                        <View style={styles.indicatorWrapper}>
                            {isPartnerLevel && !isSelected && (
                                <View style={styles.partnerRing}>
                                    {partnerAvatar ? (
                                        <Image
                                            source={{ uri: partnerAvatar }}
                                            style={styles.partnerAvatarSmall}
                                            cachePolicy="memory-disk"
                                            contentFit="cover"
                                            transition={150}
                                        />
                                    ) : (
                                        <Ionicons name="heart" size={8} color={colors.secondary} />
                                    )}
                                </View>
                            )}
                            <View style={[
                                styles.levelIndicator,
                                isActive && styles.levelIndicatorActive,
                                isSelected && {
                                    backgroundColor: HEAT_COLORS[level.level - 1],
                                    borderColor: HEAT_COLORS[level.level - 1],
                                },
                                isPartnerLevel && !isSelected && styles.levelIndicatorPartner,
                            ]}>
                                {isSelected ? (
                                    <Text style={styles.levelEmoji}>{level.emoji}</Text>
                                ) : (
                                    <Ionicons
                                        name={isActive ? 'flame' : 'flame-outline'}
                                        size={16}
                                        color={isActive ? colors.text : colors.textTertiary}
                                    />
                                )}
                            </View>
                        </View>
                        <Text style={[
                            styles.levelLabel,
                            isSelected && styles.levelLabelActive,
                            isPartnerLevel && !isSelected && styles.levelLabelPartner,
                        ]}>
                            {level.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
