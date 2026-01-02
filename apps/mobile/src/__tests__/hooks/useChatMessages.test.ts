import { useChatMessages } from '@/features/chat/hooks';
import { useMessageSubscription } from '@/hooks';

describe('useChatMessages', () => {
    it('re-exports useMessageSubscription', () => {
        expect(useChatMessages).toBe(useMessageSubscription);
    });
});
