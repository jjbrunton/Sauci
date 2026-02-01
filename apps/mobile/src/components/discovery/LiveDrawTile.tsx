import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, radius, typography, shadows, tileColors } from '../../theme';
import { useAuthStore } from '../../store';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = spacing.lg;
const TILE_HEIGHT = 100;

interface LiveDrawTileProps {
  delay?: number;
}

export function LiveDrawTile({ delay = 0 }: LiveDrawTileProps) {
  const { user } = useAuthStore();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!user?.couple_id) return;

    router.push({ pathname: '/(app)/live-draw', params: { coupleId: user.couple_id } } as any);
  };

  if (!user?.couple_id) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Activities</Text>
      </View>

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={styles.tileWrapper}
      >
        <View style={[styles.tile, shadows.md]}>
          <View style={styles.iconContainer}>
            <Ionicons name="brush" size={24} color="rgba(255, 255, 255, 0.9)" />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Live Draw</Text>
            <Text style={styles.subtitle}>Draw together with your partner in real-time</Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.6)" />

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
  header: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.callout,
    color: colors.text,
    fontWeight: '600',
  },
  tileWrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tileColors.teal,
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: radius.lg,
    pointerEvents: 'none',
  },
});
