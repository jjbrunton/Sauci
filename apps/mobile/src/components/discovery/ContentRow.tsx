import React from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ContentTile, TILE_WIDTH } from './ContentTile';
import { colors, spacing, typography } from '../../theme';
import type { QuestionPack } from '@/types';
import type { PackProgressData } from '../../store/packsStore';

interface ContentRowProps {
  title: string;
  packs: QuestionPack[];
  isPremiumUser: boolean;
  delay?: number;
  showSeeAll?: boolean;
  categoryId?: string;
  getPackProgress?: (packId: string) => PackProgressData | undefined;
  onShowPaywall?: () => void;
}

export function ContentRow({
  title,
  packs,
  isPremiumUser,
  delay = 0,
  showSeeAll = false,
  categoryId,
  getPackProgress,
  onShowPaywall,
}: ContentRowProps) {
  const handleSeeAll = () => {
    // Navigate to packs screen with category filter
    router.push({
      pathname: '/',
      params: categoryId ? { category: categoryId } : undefined,
    });
  };

  const handleTilePress = (pack: QuestionPack) => {
    // Locked packs show paywall immediately
    const isLocked = pack.is_premium && !isPremiumUser;
    if (isLocked) {
      onShowPaywall?.();
      return;
    }
    // Unlocked packs start playing immediately
    router.push({
      pathname: '/(app)/swipe',
      params: { packId: pack.id },
    });
  };

  if (packs.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {showSeeAll && (
          <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal scroll */}
      <FlatList
        data={packs}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={TILE_WIDTH + spacing.sm}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <ContentTile
            pack={item}
            isLocked={item.is_premium && !isPremiumUser}
            progress={getPackProgress?.(item.id)}
            onPress={() => handleTilePress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.callout,
    color: colors.text,
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    ...typography.subhead,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  separator: {
    width: spacing.sm,
  },
});

export default ContentRow;
