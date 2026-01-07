import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SettingsSection } from './SettingsSection';
import { colors, featureColors, spacing, typography, radius } from '../../../theme';
import { Profile, Couple } from '../../../types';

const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

interface CoupleStatusProps {
    partner: Profile | null;
    couple: Couple | null;
    onUnpair: () => void;
    onPairingPress: () => void;
}

const formatPairedDate = (date: string | null | undefined): string | null => {
    if (!date) return null;
    const paired = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - paired.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Paired today';
    if (diffDays === 1) return 'Paired yesterday';
    if (diffDays < 7) return `Paired ${diffDays} days ago`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `Paired ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `Paired ${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `Paired ${years} ${years === 1 ? 'year' : 'years'} ago`;
};

export const CoupleStatus: React.FC<CoupleStatusProps> = ({
    partner,
    couple,
    onUnpair,
    onPairingPress,
}) => {
    const pairedLabel = formatPairedDate(couple?.created_at);

    return (
        <SettingsSection title="Partner" delay={300}>
            {partner ? (
                <View style={styles.rowContainer}>
                    <View style={styles.rowLeft}>
                        {partner.avatar_url ? (
                            <View style={styles.partnerAvatarContainer}>
                                <LinearGradient
                                    colors={ACCENT_GRADIENT}
                                    style={styles.partnerAvatarGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Image
                                        source={{ uri: partner.avatar_url }}
                                        style={styles.partnerAvatar}
                                        cachePolicy="disk"
                                        transition={200}
                                    />
                                </LinearGradient>
                                <View style={styles.connectedBadge}>
                                    <Ionicons name="heart" size={10} color={colors.text} />
                                </View>
                            </View>
                        ) : (
                            <LinearGradient
                                colors={ACCENT_GRADIENT}
                                style={styles.partnerIconGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.partnerInitial}>
                                    {(partner.name?.[0] || partner.email?.[0] || 'P').toUpperCase()}
                                </Text>
                            </LinearGradient>
                        )}
                        <View style={styles.rowTextContainer}>
                            <Text style={styles.rowValue}>
                                {partner.name || partner.email || 'Your partner'}
                            </Text>
                            <Text style={styles.rowLabel}>
                                {pairedLabel || 'Connected'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onUnpair}
                        style={styles.unlinkButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="unlink-outline" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            ) : couple ? (
                <TouchableOpacity
                    style={styles.rowContainer}
                    onPress={onPairingPress}
                    activeOpacity={0.7}
                >
                    <View style={styles.rowLeft}>
                        <LinearGradient
                            colors={ACCENT_GRADIENT}
                            style={styles.partnerIconGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="hourglass-outline" size={20} color={colors.text} />
                        </LinearGradient>
                        <View style={styles.rowTextContainer}>
                            <Text style={styles.rowValue}>Waiting for partner</Text>
                            <Text style={styles.rowLabel}>Tap to view invite code</Text>
                        </View>
                    </View>
                    <View style={styles.chevronContainer}>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </View>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={styles.rowContainer}
                    onPress={onPairingPress}
                    activeOpacity={0.7}
                >
                    <View style={styles.rowLeft}>
                        <View style={styles.emptyPartnerIcon}>
                            <Ionicons name="heart-outline" size={20} color={colors.textTertiary} />
                        </View>
                        <View style={styles.rowTextContainer}>
                            <Text style={styles.rowValueMuted}>Not paired yet</Text>
                            <Text style={styles.rowLabel}>Tap to connect</Text>
                        </View>
                    </View>
                    <View style={styles.chevronContainer}>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </View>
                </TouchableOpacity>
            )}
        </SettingsSection>
    );
};

const styles = StyleSheet.create({
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    partnerAvatarContainer: {
        position: 'relative',
    },
    partnerAvatarGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    partnerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background,
    },
    connectedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.backgroundLight,
    },
    partnerIconGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    partnerInitial: {
        ...typography.title3,
        color: colors.text,
        fontWeight: '600',
    },
    emptyPartnerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.glass.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.glass.border,
        borderStyle: 'dashed',
    },
    rowTextContainer: {
        marginLeft: spacing.md,
        flex: 1,
    },
    rowValue: {
        ...typography.body,
        fontWeight: '600',
        color: colors.text,
    },
    rowValueMuted: {
        ...typography.body,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    rowLabel: {
        ...typography.caption1,
        color: colors.textTertiary,
        marginTop: 2,
    },
    unlinkButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.glass.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
