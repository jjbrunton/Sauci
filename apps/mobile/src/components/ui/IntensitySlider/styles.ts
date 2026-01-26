import { StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../../theme';

export const styles = StyleSheet.create({
    container: {
        gap: spacing.md,
    },
    containerDisabled: {
        opacity: 0.6,
    },
    trackContainer: {
        paddingHorizontal: spacing.lg,
    },
    track: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
    },
    levelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xs,
    },
    levelButton: {
        alignItems: 'center',
        flex: 1,
    },
    indicatorWrapper: {
        position: 'relative',
        marginBottom: spacing.xs,
    },
    levelIndicator: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundLight, // Flat
        borderWidth: 2,
        borderColor: colors.border,
    },
    levelIndicatorActive: {
        backgroundColor: colors.background, // Nested
        borderColor: colors.primary,
    },
    levelIndicatorPartner: {
        borderColor: colors.secondary,
        borderStyle: 'dashed',
    },
    partnerRing: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        borderWidth: 2,
        borderColor: colors.backgroundLight,
    },
    partnerAvatarSmall: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    levelEmoji: {
        fontSize: 16,
    },
    levelLabel: {
        ...typography.caption2,
        color: colors.textTertiary,
        textAlign: 'center',
    },
    levelLabelActive: {
        color: colors.text,
        fontWeight: '600',
    },
    levelLabelPartner: {
        color: colors.secondary,
    },
    currentCard: {
        backgroundColor: colors.backgroundLight, // Flat
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    currentCardWarning: {
        borderColor: colors.warning,
        backgroundColor: colors.background, // Use background for warning state to differentiate
    },
    currentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    currentEmoji: {
        fontSize: 20,
    },
    currentLabel: {
        ...typography.subhead,
        fontWeight: '600',
        color: colors.text,
    },
    matchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 'auto',
        backgroundColor: 'rgba(46, 204, 113, 0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
    },
    matchBadgeText: {
        ...typography.caption2,
        color: colors.success,
        fontWeight: '600',
    },
    currentDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    mismatchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    partnerAvatarTiny: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    partnerIconTiny: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(155, 89, 182, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mismatchText: {
        ...typography.caption1,
        color: colors.textSecondary,
        flex: 1,
    },
    mismatchTextWarning: {
        color: colors.warning,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: colors.backgroundLight, // Flat
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalInner: {
        padding: spacing.lg,
        backgroundColor: colors.backgroundLight,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalIconGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        ...typography.title3,
        color: colors.text,
        textAlign: 'center',
    },
    comparisonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    comparisonPerson: {
        alignItems: 'center',
        flex: 1,
    },
    comparisonAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    comparisonAvatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginBottom: spacing.xs,
    },
    comparisonEmoji: {
        fontSize: 24,
    },
    comparisonName: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '600',
    },
    comparisonLevel: {
        ...typography.caption2,
        color: colors.textSecondary,
    },
    comparisonDivider: {
        width: 40,
        alignItems: 'center',
    },
    modalExplanation: {
        marginBottom: spacing.lg,
    },
    modalText: {
        ...typography.subhead,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.md,
    },
    modalSubtext: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    modalTip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        borderRadius: radius.md,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    modalTipWarning: {
        backgroundColor: 'rgba(243, 156, 18, 0.1)',
    },
    modalTipText: {
        ...typography.caption1,
        color: colors.success,
        flex: 1,
    },
    modalTipTextWarning: {
        color: colors.warning,
    },
    modalCloseButton: {
        backgroundColor: colors.background,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalCloseText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: '600',
    },
});
