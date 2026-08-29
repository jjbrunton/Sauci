import { fireEvent, render } from '@/test/test-utils';
import { PendingQuestionsCard, formatWaitingSince } from '@/components/discovery/PendingQuestionsCard';
import type { PendingQuestion } from '@/store';

const pendingQuestion = (id: string, partnerAnsweredAt: string): PendingQuestion => ({
  id: `response-${id}`,
  partnerAnsweredAt,
  question: {
    id,
    pack_id: 'pack-1',
    text: `Question ${id}`,
    intensity: 1,
    created_at: '2026-08-01T00:00:00.000Z',
    pack: { id: 'pack-1', name: 'Connection', icon: 'heart' },
  },
});

describe('PendingQuestionsCard', () => {
  it('stays out of Home when there is nothing to answer', () => {
    const { queryByTestId } = render(
      <PendingQuestionsCard questions={[]} partnerName="Sam" onPress={jest.fn()} />,
    );

    expect(queryByTestId('pending-questions-card')).toBeNull();
  });

  it('names the partner, shows the count, and preserves answer privacy', () => {
    const questions = [
      pendingQuestion('q1', '2026-08-29T09:00:00.000Z'),
      pendingQuestion('q2', '2026-08-29T10:00:00.000Z'),
    ];
    const { getByText, getByLabelText } = render(
      <PendingQuestionsCard questions={questions} partnerName="Sam" onPress={jest.fn()} />,
    );

    expect(getByText('Sam has answered 2 questions')).toBeTruthy();
    expect(getByText('Answer yours to see where you match. Their answers stay private until you respond.')).toBeTruthy();
    expect(getByLabelText('2 questions waiting')).toBeTruthy();
  });

  it('starts the answer action from its accessible CTA', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PendingQuestionsCard
        questions={[pendingQuestion('q1', '2026-08-29T09:00:00.000Z')]}
        partnerName="Sam"
        onPress={onPress}
      />,
    );

    fireEvent.press(getByTestId('pending-questions-answer'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('formatWaitingSince', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');

  it('formats useful compact waiting ages', () => {
    expect(formatWaitingSince('2026-08-29T11:59:30.000Z', now)).toBe('just now');
    expect(formatWaitingSince('2026-08-29T11:42:00.000Z', now)).toBe('18m ago');
    expect(formatWaitingSince('2026-08-29T09:00:00.000Z', now)).toBe('3h ago');
    expect(formatWaitingSince('2026-08-27T12:00:00.000Z', now)).toBe('2d ago');
  });
});
