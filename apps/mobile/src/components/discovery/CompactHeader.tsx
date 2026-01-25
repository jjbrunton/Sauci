import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../theme';
import type { Profile, Couple } from '@/types';

interface CompactHeaderProps {
  user: Profile | null;
  partner: Profile | null;
  couple: Couple | null;
}

export function CompactHeader({ user, partner, couple }: CompactHeaderProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(500).springify()}
      style={styles.container}
    >
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.welcomeLabel}>Discover</Text>
          <Text style={styles.greeting}>
            Hey, {user?.name || 'Beautiful'}
          </Text>
        </View>

        {/* Partner badge */}
        {partner ? (
          <View style={styles.partnerBadge}>
            <Ionicons name="heart" size={12} color={colors.primary} />
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
        )}
      </View>
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
