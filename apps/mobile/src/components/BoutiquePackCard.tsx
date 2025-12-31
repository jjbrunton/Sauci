import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
} from 'react-native-reanimated';
import { ShimmerEffect } from './ui/ShimmerEffect';
import { colors, gradients, spacing, radius, typography, blur, shadows, animations } from '../theme';
import type { QuestionPack } from '../types';

// Boutique gradient palette for pack cards
const BOUTIQUE_GRADIENTS: Array<readonly [string, string]> = [
  gradients.boutiqueRose as [string, string],
  gradients.boutiquePurple as [string, string],
  gradients.boutiqueDusty as [string, string],
  gradients.boutiqueAmethyst as [string, string],
  gradients.boutiqueMidnight as [string, string],
  gradients.boutiqueGold as [string, string],
];

interface BoutiquePackCardProps {
  pack: QuestionPack;
  index: number;
  isEnabled: boolean;
  isPremiumLocked: boolean;
  onPress: () => void;
  onToggle: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function BoutiquePackCard({
  pack,
  index,
  isEnabled,
  isPremiumLocked,
  onPress,
  onToggle,
}: BoutiquePackCardProps) {
  const scale = useSharedValue(1);
  const cardGradient = BOUTIQUE_GRADIENTS[index % BOUTIQUE_GRADIENTS.length];
  const questionCount = pack.questions?.[0]?.count || 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, animations.spring);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, animations.spring);
  };

  const useBlur = Platform.OS === 'ios';

  const cardContent = (
    <View style={styles.cardInner}>
      {/* Background gradient */}
      <LinearGradient
        colors={cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Glass overlay */}
      {useBlur ? (
        <BlurView
          intensity={blur.light}
          tint="dark"
          style={[StyleSheet.absoluteFill, styles.glassOverlay]}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.glassOverlayFallback]} />
      )}

      {/* Silk texture effect */}
      <LinearGradient
        colors={gradients.silkLight as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
      />

      {/* Top highlight */}
      <LinearGradient
        colors={[colors.glass.highlight, 'transparent']}
        style={styles.topHighlight}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* PRO Badge (top-right) */}
        {pack.is_premium && (
          <View style={[
            styles.proBadge,
            isPremiumLocked && styles.proBadgeLocked
          ]}>
            <Ionicons
              name={isPremiumLocked ? 'lock-closed' : 'star'}
              size={10}
              color={colors.text}
            />
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        )}

        {/* Pack Icon */}
        <View style={[
          styles.iconContainer,
          isEnabled && styles.iconContainerActive,
          pack.is_premium && !isPremiumLocked && styles.iconContainerPremium,
        ]}>
          <Text style={styles.packEmoji}>{pack.icon || '📦'}</Text>
        </View>

        {/* Pack Name */}
        <Text
          style={[
            styles.packName,
            isPremiumLocked && styles.packNameLocked,
          ]}
          numberOfLines={2}
        >
          {pack.name}
        </Text>

        {/* Description */}
        <Text
          style={[
            styles.packDescription,
            isPremiumLocked && styles.packDescriptionLocked,
          ]}
          numberOfLines={2}
        >
          {isPremiumLocked ? 'Unlock with Pro' : pack.description}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.questionBadge}>
            <Text style={styles.questionCount}>{questionCount}</Text>
            <Text style={styles.questionLabel}>questions</Text>
          </View>

          <Switch
            value={isEnabled}
            onValueChange={onToggle}
            disabled={isPremiumLocked}
            trackColor={{
              false: 'rgba(255, 255, 255, 0.15)',
              true: pack.is_premium ? colors.premium.gold : colors.primary,
            }}
            thumbColor={colors.text}
            ios_backgroundColor="rgba(255, 255, 255, 0.15)"
            style={isPremiumLocked ? { opacity: 0.4 } : undefined}
          />
        </View>
      </View>

      {/* Lock overlay for premium locked packs */}
      {isPremiumLocked && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.lockOverlay}
        >
          <View style={styles.lockIconContainer}>
            <Ionicons name="lock-closed" size={28} color={colors.premium.gold} />
          </View>
        </Animated.View>
      )}
    </View>
  );

  const wrappedCard = pack.is_premium && !isPremiumLocked ? (
    <ShimmerEffect enabled={true} style={styles.shimmerWrapper}>
      {cardContent}
    </ShimmerEffect>
  ) : (
    cardContent
  );

  return (
    <AnimatedTouchableOpacity
      style={[
        styles.card,
        animatedStyle,
        pack.is_premium && !isPremiumLocked && styles.cardPremium,
        isEnabled && styles.cardEnabled,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      {wrappedCard}
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  cardPremium: {
    borderWidth: 1,
    borderColor: colors.premium.gold,
    ...shadows.glow(colors.premium.goldGlow),
  },
  cardEnabled: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  shimmerWrapper: {
    borderRadius: radius.lg,
  },
  cardInner: {
    minHeight: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  glassOverlay: {
    backgroundColor: 'rgba(22, 33, 62, 0.3)',
  },
  glassOverlayFallback: {
    backgroundColor: 'rgba(22, 33, 62, 0.5)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  proBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.premium.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
    gap: 3,
    zIndex: 10,
  },
  proBadgeLocked: {
    backgroundColor: colors.glass.backgroundLight,
  },
  proBadgeText: {
    ...typography.caption2,
    color: colors.text,
    fontWeight: '700',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconContainerActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  iconContainerPremium: {
    backgroundColor: colors.premium.goldLight,
    borderColor: colors.premium.gold,
  },
  packEmoji: {
    fontSize: 28,
  },
  packName: {
    ...typography.headline,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  packNameLocked: {
    color: colors.textSecondary,
  },
  packDescription: {
    ...typography.caption1,
    color: colors.textSecondary,
    flex: 1,
  },
  packDescriptionLocked: {
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  questionBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  questionCount: {
    ...typography.headline,
    color: colors.text,
  },
  questionLabel: {
    ...typography.caption2,
    color: colors.textTertiary,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.premium.gold,
  },
});

export default BoutiquePackCard;
