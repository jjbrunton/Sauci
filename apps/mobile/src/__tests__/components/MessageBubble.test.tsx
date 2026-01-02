import React from 'react';
import { Text } from 'react-native';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { render } from '@/test/test-utils';

describe('MessageBubble', () => {
    it('renders children for my message', () => {
        const { getByText } = render(
            <MessageBubble isMe index={0}>
                <Text>hello</Text>
            </MessageBubble>
        );

        expect(getByText('hello')).toBeTruthy();
    });

    it('renders children for their message', () => {
        const { getByText } = render(
            <MessageBubble isMe={false} index={0}>
                <Text>hi</Text>
            </MessageBubble>
        );

        expect(getByText('hi')).toBeTruthy();
    });
});
