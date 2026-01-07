import React from 'react';
import { InputBar } from '@/features/chat/components/InputBar';
import { fireEvent, render } from '@/test/test-utils';

describe('InputBar', () => {
    it('calls onChangeText when typing', () => {
        const onChangeText = jest.fn();

        const { getByPlaceholderText } = render(
            <InputBar
                inputText=""
                uploading={false}
                secureReady={true}
                onChangeText={onChangeText}
                onSend={jest.fn()}
                onPickMedia={jest.fn()}
                onTakePhoto={jest.fn()}
                onRecordVideo={jest.fn()}
            />
        );

        fireEvent.changeText(getByPlaceholderText('Type a message...'), 'hello');
        expect(onChangeText).toHaveBeenCalledWith('hello');
    });

    it('disables send when input is empty', () => {
        const onSend = jest.fn();

        const { getByTestId } = render(
            <InputBar
                inputText=""
                uploading={false}
                secureReady={true}
                onChangeText={jest.fn()}
                onSend={onSend}
                onPickMedia={jest.fn()}
                onTakePhoto={jest.fn()}
                onRecordVideo={jest.fn()}
            />
        );

        fireEvent.press(getByTestId('chat-input-send'));
        expect(onSend).not.toHaveBeenCalled();
    });

    it('calls onSend when input has content', () => {
        const onSend = jest.fn();

        const { getByTestId, rerender } = render(
            <InputBar
                inputText=""
                uploading={false}
                secureReady={true}
                onChangeText={jest.fn()}
                onSend={onSend}
                onPickMedia={jest.fn()}
                onTakePhoto={jest.fn()}
                onRecordVideo={jest.fn()}
            />
        );

        rerender(
            <InputBar
                inputText="hi"
                uploading={false}
                secureReady={true}
                onChangeText={jest.fn()}
                onSend={onSend}
                onPickMedia={jest.fn()}
                onTakePhoto={jest.fn()}
                onRecordVideo={jest.fn()}
            />
        );

        fireEvent.press(getByTestId('chat-input-send'));
        expect(onSend).toHaveBeenCalledTimes(1);
    });

    it('disables send when secure messaging is not ready', () => {
        const onSend = jest.fn();

        const { getByTestId } = render(
            <InputBar
                inputText="hello"
                uploading={false}
                secureReady={false}
                onChangeText={jest.fn()}
                onSend={onSend}
                onPickMedia={jest.fn()}
                onTakePhoto={jest.fn()}
                onRecordVideo={jest.fn()}
            />
        );

        fireEvent.press(getByTestId('chat-input-send'));
        expect(onSend).not.toHaveBeenCalled();
    });

    it('calls media actions from menu buttons', () => {
        const onPickMedia = jest.fn();
        const onTakePhoto = jest.fn();
        const onRecordVideo = jest.fn();

        const { getByTestId } = render(
            <InputBar
                inputText="hello"
                uploading={false}
                secureReady={true}
                onChangeText={jest.fn()}
                onSend={jest.fn()}
                onPickMedia={onPickMedia}
                onTakePhoto={onTakePhoto}
                onRecordVideo={onRecordVideo}
            />
        );

        fireEvent.press(getByTestId('chat-input-toggle-media'));

        fireEvent.press(getByTestId('chat-input-take-photo'));
        expect(onTakePhoto).toHaveBeenCalledTimes(1);

        fireEvent.press(getByTestId('chat-input-record-video'));
        expect(onRecordVideo).toHaveBeenCalledTimes(1);

        fireEvent.press(getByTestId('chat-input-pick-media'));
        expect(onPickMedia).toHaveBeenCalledTimes(1);
    });
});
