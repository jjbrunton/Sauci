import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, radius, typography, shadows, tileColors } from '../../theme';
import { useAuthStore } from '../../store';
import { useIncomingDareCount } from '../../features/dares/hooks/useIncomingDareCount';

const HORIZONTAL_PADDING = spacing.lg;
const TILE_HEIGHT = 100;

interface DaresTileProps {
  delay?: number;
}

export function DaresTile({ delay = 0 }: DaresTileProps) {
  const { user } = useAuthStore();
  const paired = Boolean(user?.couple_id);
  const pending = useIncomingDareCount(paired);

  if (!paired) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(app)/dares' as never);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={styles.container}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.tileWrapper}>
        <View style={[styles.tile, shadows.md]}>
          <View style={styles.iconContainer}>
            <Ionicons name="flame" size={24} color="rgba(255, 255, 255, 0.9)" />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Dares</Text>
            <Text style={styles.subtitle}>
              {pending > 0
                ? `${pending} dare${pending === 1 ? '' : 's'} waiting for you`
                : 'Challenge your partner to something playful'}
            </Text>
          </View>

          {pending > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pending}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.6)" />
          )}

          <View style={styles.overlay} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  tileWrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tileColors.amber,
    borderRadius: radius.lg,
    padding: spacing.md,
    height: TILE_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.headline,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption1,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: radius.lg,
    pointerEvents: 'none',
  },
});
