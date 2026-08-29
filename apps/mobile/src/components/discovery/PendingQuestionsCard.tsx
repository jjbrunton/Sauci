import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { PendingQuestion } from '../../store';
import { colors, gradients, radius, shadows, spacing, typography } from '../../theme';

interface PendingQuestionsCardProps {
  questions: PendingQuestion[];
  partnerName?: string | null;
  onPress: () => void;
  delay?: number;
}

export function formatWaitingSince(dateString: string, now = new Date()): string {
  const answeredAt = new Date(dateString);
  const diffMs = Math.max(0, now.getTime() - answeredAt.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return answeredAt.toLocaleDateString();
}

export function PendingQuestionsCard({
  questions,
  partnerName,
  onPress,
  delay = 0,
}: PendingQuestionsCardProps) {
  const oldestQuestion = useMemo(
    () => questions.reduce<PendingQuestion | null>((oldest, question) => {
      if (!oldest) return question;
      return new Date(question.partnerAnsweredAt) < new Date(oldest.partnerAnsweredAt)
        ? question
        : oldest;
    }, null),
    [questions],
  );

  if (!oldestQuestion) return null;

  const count = questions.length;
  const subject = partnerName?.trim() || 'Your partner';
  const questionLabel = count === 1 ? 'question' : 'questions';

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(450).springify()}
      style={styles.container}
      testID="pending-questions-card"
    >
      <View style={[styles.card, shadows.md]}>
        <View style={styles.accent} />

        <View style={styles.labelRow}>
          <View style={styles.labelGroup}>
            <View style={styles.statusDot} />
            <Text style={styles.label}>Your turn</Text>
          </View>
          <View style={styles.countBadge} accessibilityLabel={`${count} ${questionLabel} waiting`}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>

        <Text style={styles.title}>
          {subject} has answered {count} {questionLabel}
        </Text>
        <Text style={styles.description}>
          Answer yours to see where you match. Their answers stay private until you respond.
        </Text>

        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Answer ${count} waiting ${questionLabel}`}
          testID="pending-questions-answer"
        >
          <LinearGradient
            colors={gradients.primary as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Answer now</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.text} />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.waitingRow}>
          <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.waitingText}>
            Oldest waiting · {formatWaitingSince(oldestQuestion.partnerAnsweredAt)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(232, 164, 174, 0.36)',
    backgroundColor: colors.surface,
  },
  accent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 96,
    height: 96,
    borderBottomLeftRadius: 96,
    backgroundColor: colors.primaryLight,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    ...typography.caption1,
    color: colors.premium.rose,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  countBadge: {
    minWidth: 32,
    height: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  countText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: '800',
  },
  title: {
    ...typography.title3,
    color: colors.text,
    marginTop: spacing.md,
    paddingRight: spacing.xl,
  },
  description: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.callout,
    color: colors.text,
    fontWeight: '700',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  waitingText: {
    ...typography.caption2,
    color: colors.textTertiary,
  },
});
