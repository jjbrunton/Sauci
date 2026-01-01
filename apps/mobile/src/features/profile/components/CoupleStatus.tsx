import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SettingsSection } from './SettingsSection';
import { colors, featureColors, spacing, typography } from '../../../theme';
import { Profile, Couple } from '../../../types';

const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

interface CoupleStatusProps {
    partner: Profile | null;
    couple: Couple | null;
    onUnpair: () => void;
    onPairingPress: () => void;
}

export const CoupleStatus: React.FC<CoupleStatusProps> = ({
    partner,
    couple,
    onUnpair,
    onPairingPress,
}) => {
    return (
        <SettingsSection title="Partner" delay={300}>
            {partner ? (
                <View style={styles.rowContainer}>
                    <View style={styles.rowLeft}>
                        <LinearGradient
                            colors={ACCENT_GRADIENT}
                            style={styles.partnerIconGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="heart" size={20} color={colors.text} />
                        </LinearGradient>
                        <View style={styles.rowTextContainer}>
                            <Text style={styles.rowValue}>
                                {partner.name || partner.email || 'Your partner'}
                            </Text>
                            <Text style={styles.rowLabel}>Connected</Text>
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
    partnerIconGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyPartnerIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.glass.background,
        justifyContent: 'center',
        alignItems: 'center',
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
