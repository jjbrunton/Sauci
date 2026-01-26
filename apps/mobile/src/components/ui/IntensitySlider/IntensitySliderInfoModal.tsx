import React from 'react';
import {
    Modal,
    Pressable,
    View,
    Text,
    TouchableOpacity,
    Platform,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { IntensityLevel } from '@/types';
import { colors } from '../../../theme';
import type { IntensityLevelConfig } from './constants';
import { HEAT_COLORS } from './constants';
import { styles } from './styles';

interface IntensitySliderInfoModalProps {
    visible: boolean;
    onClose: () => void;
    hasPartner: boolean;
    levelsDiffer: boolean;
    userIsHigher: boolean;
    displayPartnerName: string;
    current: IntensityLevelConfig;
    partnerLevel: IntensityLevelConfig | null;
    partnerValue?: IntensityLevel | null;
    partnerAvatar?: string | null;
}

export function IntensitySliderInfoModal({
    visible,
    onClose,
    hasPartner,
    levelsDiffer,
    userIsHigher,
    displayPartnerName,
    current,
    partnerLevel,
    partnerValue,
    partnerAvatar,
}: IntensitySliderInfoModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                style={styles.modalOverlay}
                onPress={onClose}
            >
                <Pressable style={styles.modalContent} onPress={event => event.stopPropagation()}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    ) : null}
                    <View style={styles.modalInner}>
                        <View style={styles.modalHeader}>
                            {levelsDiffer ? (
                                <LinearGradient
                                    colors={userIsHigher ? ['#F39C12', '#E67E22'] : [colors.secondary, colors.primary]}
                                    style={styles.modalIconGradient}
                                >
                                    <Ionicons
                                        name={userIsHigher ? "alert-circle" : "information-circle"}
                                        size={28}
                                        color={colors.text}
                                    />
                                </LinearGradient>
                            ) : (
                                <LinearGradient
                                    colors={[colors.success, '#27AE60']}
                                    style={styles.modalIconGradient}
                                >
                                    <Ionicons name="heart" size={28} color={colors.text} />
                                </LinearGradient>
                            )}
                            <Text style={styles.modalTitle}>
                                {levelsDiffer
                                    ? (userIsHigher ? "Different Comfort Zones" : "Room to Explore")
                                    : "You're Perfectly Matched"
                                }
                            </Text>
                        </View>

                        {hasPartner && (
                            <View style={styles.comparisonContainer}>
                                <View style={styles.comparisonPerson}>
                                    <View style={[styles.comparisonAvatar, { backgroundColor: HEAT_COLORS[current.level - 1] }]}>
                                        <Text style={styles.comparisonEmoji}>{current.emoji}</Text>
                                    </View>
                                    <Text style={styles.comparisonName}>You</Text>
                                    <Text style={styles.comparisonLevel}>{current.label}</Text>
                                </View>

                                <View style={styles.comparisonDivider}>
                                    <Ionicons
                                        name={levelsDiffer ? "swap-horizontal" : "heart"}
                                        size={20}
                                        color={levelsDiffer ? colors.textTertiary : colors.success}
                                    />
                                </View>

                                <View style={styles.comparisonPerson}>
                                    {partnerAvatar ? (
                                        <Image
                                            source={{ uri: partnerAvatar }}
                                            style={styles.comparisonAvatarImage}
                                            cachePolicy="memory-disk"
                                            contentFit="cover"
                                            transition={150}
                                        />
                                    ) : (
                                        <View style={[styles.comparisonAvatar, { backgroundColor: HEAT_COLORS[(partnerValue ?? 1) - 1] }]}>
                                            <Text style={styles.comparisonEmoji}>{partnerLevel?.emoji}</Text>
                                        </View>
                                    )}
                                    <Text style={styles.comparisonName}>{displayPartnerName}</Text>
                                    <Text style={styles.comparisonLevel}>{partnerLevel?.label}</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.modalExplanation}>
                            {!levelsDiffer ? (
                                <>
                                    <Text style={styles.modalText}>
                                        You and {displayPartnerName} have the same comfort zone setting.
                                        You'll both see the same question packs and can match on everything!
                                    </Text>
                                    <View style={styles.modalTip}>
                                        <Ionicons name="sparkles" size={16} color={colors.success} />
                                        <Text style={styles.modalTipText}>
                                            Perfect alignment means more matches
                                        </Text>
                                    </View>
                                </>
                            ) : userIsHigher ? (
                                <>
                                    <Text style={styles.modalText}>
                                        You're both seeing questions up to {partnerLevel?.label} level because that's {displayPartnerName}'s comfort zone.
                                    </Text>
                                    <View style={[styles.modalTip, styles.modalTipWarning]}>
                                        <Ionicons name="information-circle" size={16} color={colors.warning} />
                                        <Text style={[styles.modalTipText, styles.modalTipTextWarning]}>
                                            You won't see {current.label} content until {displayPartnerName} raises their level
                                        </Text>
                                    </View>
                                    <Text style={styles.modalSubtext}>
                                        The lower setting between you determines what you both see.
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.modalText}>
                                        You're both seeing questions up to {current.label} level based on your comfort zone.
                                    </Text>
                                    <View style={styles.modalTip}>
                                        <Ionicons name="arrow-up-circle" size={16} color={colors.secondary} />
                                        <Text style={styles.modalTipText}>
                                            {displayPartnerName} is at {partnerLevel?.label} — raise yours to unlock more content together
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={onClose}
                        >
                            <Text style={styles.modalCloseText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
