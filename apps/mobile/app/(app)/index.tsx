import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Platform, View, Text, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuthStore, usePacksStore, useSubscriptionStore } from '../../src/store';
import { GradientBackground } from '../../src/components/ui';
import { Paywall } from '../../src/components/paywall';
import { CompactHeader, ContentRow, LiveDrawTile } from '../../src/components/discovery';
import { colors, spacing, typography, radius } from '../../src/theme';
import type { QuestionPack, Category } from '../../src/types';

const MAX_CONTENT_WIDTH = 600;

// Group packs by category
function groupPacksByCategory(
  packs: QuestionPack[],
  categories: Category[]
): { category: Category; packs: QuestionPack[] }[] {
  const categoryMap = new Map<string, QuestionPack[]>();
  const uncategorized: QuestionPack[] = [];

  // Initialize map with empty arrays for each category
  categories.forEach((cat) => {
    categoryMap.set(cat.id, []);
  });

  // Group packs
  packs.forEach((pack) => {
    if (pack.category_id && categoryMap.has(pack.category_id)) {
      categoryMap.get(pack.category_id)!.push(pack);
    } else {
      uncategorized.push(pack);
    }
  });

  // Build result array maintaining category sort order
  const result: { category: Category; packs: QuestionPack[] }[] = [];

  categories.forEach((cat) => {
    const categoryPacks = categoryMap.get(cat.id) || [];
    if (categoryPacks.length > 0) {
      result.push({ category: cat, packs: categoryPacks });
    }
  });

  // Add uncategorized at the end if any
  if (uncategorized.length > 0) {
    result.push({
      category: {
        id: 'uncategorized',
        name: 'More',
        description: null,
        icon: 'ellipsis-horizontal',
        color: null,
        sort_order: 999,
        created_at: '',
        is_public: true,
      },
      packs: uncategorized,
    });
  }

  return result;
}

export default function DiscoveryScreen() {
  const { user, partner, couple } = useAuthStore();
  const { packs, categories, fetchPacks, getPackProgress } = usePacksStore();
  const { subscription } = useSubscriptionStore();
  const { width } = useWindowDimensions();
  const [showPaywall, setShowPaywall] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(130);

  // Check all sources of premium access: user flag, partner flag, or active subscription
  const isPremiumUser = user?.is_premium || partner?.is_premium || subscription.isProUser;
  const isWideScreen = width > MAX_CONTENT_WIDTH;

  // Refresh data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchPacks();
    }, [])
  );

  // Group packs by category
  const packsByCategory = useMemo(
    () => groupPacksByCategory(packs, categories),
    [packs, categories]
  );

  // Check if user has no packs enabled (empty state)
  const hasNoPacks = packs.length === 0;

  return (
    <GradientBackground>
      <View
        style={[styles.stickyHeader, isWideScreen && styles.stickyHeaderWide]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14, 14, 17, 0.85)' }]} />
        <CompactHeader user={user} partner={partner} couple={couple} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          isWideScreen && styles.contentContainerWide,
          { paddingTop: headerHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.innerContainer, isWideScreen && styles.innerContainerWide]}>
          {/* Live Draw Activity Tile */}
          <LiveDrawTile delay={100} />

          {/* Content Rows by Category */}
          {packsByCategory.map((group, index) => (
            <ContentRow
              key={group.category.id}
              title={group.category.name}
              packs={group.packs}
              isPremiumUser={isPremiumUser}
              categoryId={group.category.id}
              delay={200 + index * 100}
              getPackProgress={getPackProgress}
              onShowPaywall={() => setShowPaywall(true)}
            />
          ))}

          {/* Empty state when no packs */}
          {hasNoPacks && (
            <Animated.View
              entering={FadeInDown.delay(300).duration(500).springify()}
              style={styles.emptyState}
            >
              <View style={styles.emptyIcon}>
                <Ionicons name="layers-outline" size={48} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No packs available</Text>
              <Text style={styles.emptySubtitle}>
                Check back soon for new content
              </Text>
            </Animated.View>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => {
          setShowPaywall(false);
          fetchPacks(); // Refresh packs to update lock status
        }}
      />
    </GradientBackground>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  contentContainerWide: {
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
  },
  innerContainerWide: {
    maxWidth: MAX_CONTENT_WIDTH,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.title3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: spacing.lg,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden', // Ensures blur doesn't bleed if we rounded corners (optional)
  },
  stickyHeaderWide: {
    left: '50%',
    right: 'auto',
    width: MAX_CONTENT_WIDTH,
    transform: [{ translateX: -MAX_CONTENT_WIDTH / 2 }],
  },
});

