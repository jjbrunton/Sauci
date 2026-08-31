import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, radius, typography, shadows, featureColors } from '../../theme';
import { useAuthStore } from '../../store';

const HORIZONTAL_PADDING = spacing.lg;
const TILE_HEIGHT = 100;
const ACCENT = featureColors.quiz.accent;

interface QuizTileProps {
  delay?: number;
}

export function QuizTile({ delay = 0 }: QuizTileProps) {
  const { user } = useAuthStore();
  const paired = Boolean(user?.couple_id);

  if (!paired) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(app)/quiz' as never);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={styles.container}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.tileWrapper}>
        <View style={[styles.tile, shadows.md]}>
          <View style={styles.iconContainer}>
            <Ionicons name="help-circle" size={24} color="rgba(255, 255, 255, 0.9)" />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Quiz</Text>
            <Text style={styles.subtitle}>How well do you know each other?</Text>
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
  tileWrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: radius.lg,
    pointerEvents: 'none',
  },
});
