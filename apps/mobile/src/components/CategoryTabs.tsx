import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { colors, gradients, spacing, radius, typography, blur, animations } from '../theme';
import type { Category } from '../types';

export type FilterType = 'all' | 'enabled' | string;

interface CategoryTabsProps {
  categories: Category[];
  selectedFilter: FilterType;
  onSelectFilter: (filter: FilterType) => void;
  enabledCount?: number;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function CategoryTab({
  label,
  icon,
  isSelected,
  onPress,
  badge,
}: {
  label: string;
  icon?: string | null;
  isSelected: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, animations.spring);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, animations.spring);
  };

  const useBlur = Platform.OS === 'ios';

  const tabInnerContent = (
    <>
      {icon === '✓' ? (
        <Ionicons name="checkmark" size={16} color={colors.text} style={{ marginRight: 2 }} />
      ) : icon ? (
        <Text style={styles.tabIcon}>{icon}</Text>
      ) : null}
      <Text style={isSelected ? styles.tabTextSelected : styles.tabText}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, isSelected && styles.badgeSelected]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </>
  );

  return (
    <AnimatedTouchableOpacity
      style={[styles.tabContainer, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.8}
    >
      {isSelected ? (
        <LinearGradient
          colors={gradients.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.tabGradient}
        >
          {tabInnerContent}
        </LinearGradient>
      ) : useBlur ? (
        <BlurView
          intensity={blur.light}
          tint="dark"
          style={styles.tabBlur}
        >
          <View style={styles.tabContent}>
            {tabInnerContent}
          </View>
        </BlurView>
      ) : (
        <View style={styles.tabFallback}>
          {tabInnerContent}
        </View>
      )}
    </AnimatedTouchableOpacity>
  );
}

export function CategoryTabs({
  categories,
  selectedFilter,
  onSelectFilter,
  enabledCount = 0,
}: CategoryTabsProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All tab */}
        <CategoryTab
          label="All"
          isSelected={selectedFilter === 'all'}
          onPress={() => onSelectFilter('all')}
        />

        {/* Enabled tab */}
        <CategoryTab
          label="Enabled"
          icon="✓"
          isSelected={selectedFilter === 'enabled'}
          onPress={() => onSelectFilter('enabled')}
          badge={enabledCount}
        />

        {/* Category tabs */}
        {categories.map((category) => (
          <CategoryTab
            key={category.id}
            label={category.name}
            icon={category.icon}
            isSelected={selectedFilter === category.id}
            onPress={() => onSelectFilter(category.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tabContainer: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  tabBlur: {
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  tabFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.glass.backgroundLight,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glass.border,
    gap: spacing.xs,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    ...typography.subhead,
    color: colors.text, // Changed from textSecondary for better accessibility
    fontWeight: '500',
  },
  tabTextSelected: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: 4,
  },
  badgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeText: {
    ...typography.caption2,
    color: colors.text,
    fontWeight: '600',
  },
});

export default CategoryTabs;
