import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../theme';
import type { Profile, Couple } from '@/types';

interface CompactHeaderProps {
  user: Profile | null;
  partner: Profile | null;
  couple: Couple | null;
  label?: string;
  accessory?: React.ReactNode;
  showGreeting?: boolean;
  showPartnerBadge?: boolean;
}

export function CompactHeader({
  user,
  partner,
  couple,
  label = 'Discover',
  accessory,
  showGreeting = true,
  showPartnerBadge = true,
}: CompactHeaderProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(500).springify()}
      style={styles.container}
    >
      {showGreeting ? (
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.welcomeLabel}>{label}</Text>
            <Text style={styles.greeting}>
              Hey, {user?.name || 'Beautiful'}
            </Text>
          </View>

          <View style={styles.rightSection}>
            {/* Partner badge */}
            {showPartnerBadge ? (
              partner ? (
                <View style={styles.partnerBadge}>
                  {partner.avatar_url ? (
                    <Image
                      source={{ uri: partner.avatar_url }}
                      style={styles.partnerAvatar}
                      cachePolicy="disk"
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <Ionicons name="heart" size={12} color={colors.primary} />
                  )}
                  <Text style={styles.partnerText} numberOfLines={1}>
                    {partner.name || partner.email?.split('@')[0] || 'Partner'}
                  </Text>
                </View>
              ) : couple ? (
                <TouchableOpacity
                  style={styles.waitingBadge}
                  onPress={() => router.push('/(app)/pairing')}
                >
                  <Ionicons name="hourglass-outline" size={12} color={colors.primary} />
                  <Text style={styles.waitingText}>Waiting</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.pairBadge}
                  onPress={() => router.push('/(app)/pairing')}
                >
                  <Ionicons name="add-circle-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.pairText}>Connect</Text>
                </TouchableOpacity>
              )
            ) : null}
            {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
          </View>
        </View>
      ) : (
        <View style={styles.titleRow}>
          {accessory ? <View style={styles.titleSpacer} /> : null}
          <Text style={styles.titleOnly}>{label}</Text>
          {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accessory: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleOnly: {
    ...typography.title2,
    color: colors.text,
    textAlign: 'center',
    flex: 1,
  },
  titleSpacer: {
    width: 32,
  },
  welcomeLabel: {
    ...typography.caption2,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  greeting: {
    ...typography.title2,
    color: colors.text,
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
    gap: spacing.xs,
    maxWidth: 140,
  },
  partnerText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: '500',
  },
  partnerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.3)',
  },
  pairBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glass.border,
    gap: spacing.xs,
  },
  pairText: {
    ...typography.caption1,
    color: colors.textTertiary,
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
    gap: spacing.xs,
  },
  waitingText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: '500',
  },
});

export default CompactHeader;
