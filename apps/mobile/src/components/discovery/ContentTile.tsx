import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography, shadows, getCategoryColor } from '../../theme';
import { CircularProgress } from './CircularProgress';
import type { QuestionPack } from '@/types';
import type { PackProgressData } from '../../store/packsStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_GAP = spacing.sm;
const HORIZONTAL_PADDING = spacing.lg;
// Calculate tile width: 2 tiles per screen with gap and padding, plus peek of next
export const TILE_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - TILE_GAP) / 2 + 8;
export const TILE_HEIGHT = 170;

interface ContentTileProps {
  pack: QuestionPack;
  isLocked: boolean;
  isNew?: boolean;
  progress?: PackProgressData;
  onPress: () => void;
}

export function ContentTile({ pack, isLocked, isNew = false, progress, onPress }: ContentTileProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  const backgroundColor = getCategoryColor(pack.category);
  const icon = pack.icon || pack.category?.icon || 'layers';

  // Calculate progress percentage
  const progressPercent = progress && progress.totalQuestions > 0
    ? progress.answeredQuestions / progress.totalQuestions
    : 0;
  // Always show progress ring when progress data exists (even at 0% or 0 questions)
  const showProgress = !!progress;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={styles.container}
    >
      <View style={[styles.tile, { backgroundColor }, shadows.md]}>
        {/* Top row: icon and badges */}
        <View style={styles.topRow}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={icon as any}
              size={20}
              color="rgba(255, 255, 255, 0.9)"
            />
          </View>
          <View style={styles.badges}>
            {pack.is_explicit && (
              <View style={styles.explicitBadge}>
                <Ionicons name="flame" size={10} color={colors.text} />
                <Text style={styles.explicitBadgeText}>18+</Text>
              </View>
            )}
            {isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
            {isLocked && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={12} color={colors.premium.gold} />
              </View>
            )}
            {showProgress && (
              <CircularProgress
                progress={progressPercent}
                size={20}
                strokeWidth={2}
              />
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {pack.category?.name && (
            <Text style={styles.categoryText} numberOfLines={1}>
              {pack.category.name}
            </Text>
          )}
          <Text style={styles.titleText} numberOfLines={2}>
            {pack.name}
          </Text>
        </View>

        {/* Decorative overlay for depth */}
        <View style={styles.overlay} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: radius.lg,
    pointerEvents: 'none',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  explicitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    gap: 2,
  },
  explicitBadgeText: {
    ...typography.caption2,
    fontWeight: '700',
    color: colors.text,
  },
  newBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  newBadgeText: {
    ...typography.caption2,
    fontWeight: '700',
    color: colors.background,
    letterSpacing: 0.5,
  },
  lockBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  categoryText: {
    ...typography.caption2,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  titleText: {
    ...typography.headline,
    color: colors.text,
    fontWeight: '700',
  },
});

export default ContentTile;
