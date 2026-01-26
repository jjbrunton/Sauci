import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { IntensityLevel } from '@/types';
import { INTENSITY_LEVELS } from './IntensitySlider/constants';
import { IntensitySliderCurrentCard } from './IntensitySlider/IntensitySliderCurrentCard';
import { IntensitySliderInfoModal } from './IntensitySlider/IntensitySliderInfoModal';
import { IntensitySliderLevels } from './IntensitySlider/IntensitySliderLevels';
import { IntensitySliderTrack } from './IntensitySlider/IntensitySliderTrack';
import { styles } from './IntensitySlider/styles';

export interface IntensitySliderProps {
    value: IntensityLevel;
    onValueChange: (value: IntensityLevel) => void;
    disabled?: boolean;
    /** Partner's intensity level (shows as a ghost indicator) */
    partnerValue?: IntensityLevel | null;
    /** Partner's name for the mismatch message */
    partnerName?: string;
    /** Partner's avatar URL */
    partnerAvatar?: string | null;
}

const triggerHaptic = async () => {
    if (Platform.OS === 'web') return;
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export function IntensitySlider({
    value,
    onValueChange,
    disabled = false,
    partnerValue,
    partnerName,
    partnerAvatar,
}: IntensitySliderProps) {
    const current = INTENSITY_LEVELS[value - 1] ?? INTENSITY_LEVELS[1];
    const progress = useSharedValue((value - 1) / 4);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const hasPartner = partnerValue != null;
    const partnerLevel = hasPartner ? INTENSITY_LEVELS[partnerValue - 1] : null;
    const levelsDiffer = hasPartner && value !== partnerValue;
    const userIsHigher = hasPartner && value > partnerValue;
    const displayPartnerName = partnerName || 'Your partner';

    useEffect(() => {
        progress.value = withSpring((value - 1) / 4, { damping: 15, stiffness: 150 });
    }, [value]);

    const handleSelect = async (nextValue: IntensityLevel) => {
        if (disabled || nextValue === value) return;
        await triggerHaptic();
        onValueChange(nextValue);
    };

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const getMismatchMessage = () => {
        if (!levelsDiffer || !partnerLevel) return null;
        if (userIsHigher) {
            return `${displayPartnerName} is at ${partnerLevel.label} — tap for details`;
        }
        return `${displayPartnerName} is at ${partnerLevel.label}`;
    };

    return (
        <View style={[styles.container, disabled && styles.containerDisabled]}>
            <IntensitySliderTrack value={value} progressStyle={progressStyle} />
            <IntensitySliderLevels
                value={value}
                disabled={disabled}
                partnerValue={partnerValue}
                partnerAvatar={partnerAvatar}
                onSelect={handleSelect}
            />
            <IntensitySliderCurrentCard
                current={current}
                levelsDiffer={levelsDiffer}
                userIsHigher={userIsHigher}
                hasPartner={hasPartner}
                partnerAvatar={partnerAvatar}
                mismatchMessage={getMismatchMessage()}
                onShowInfo={() => setShowInfoModal(true)}
            />
            <IntensitySliderInfoModal
                visible={showInfoModal}
                onClose={() => setShowInfoModal(false)}
                hasPartner={hasPartner}
                levelsDiffer={levelsDiffer}
                userIsHigher={userIsHigher}
                displayPartnerName={displayPartnerName}
                current={current}
                partnerLevel={partnerLevel}
                partnerValue={partnerValue}
                partnerAvatar={partnerAvatar}
            />
        </View>
    );
}

export default IntensitySlider;
