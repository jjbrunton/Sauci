import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const makeRecording = (overrides: Record<string, unknown> = {}) => ({
    getStatusAsync: jest.fn(async () => ({ isRecording: true, durationMillis: 2400 })),
    stopAndUnloadAsync: jest.fn(async () => undefined),
    getURI: jest.fn(() => 'file://recording.m4a'),
    setOnRecordingStatusUpdate: jest.fn(),
    setProgressUpdateInterval: jest.fn(),
    ...overrides,
});

describe('useAudioRecorder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it('alerts and refuses to start without microphone permission', async () => {
        (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
        const { result } = renderHook(() => useAudioRecorder());

        let started = true;
        await act(async () => { started = await result.current.startRecording(); });

        expect(started).toBe(false);
        expect(Alert.alert).toHaveBeenCalledWith(
            'Microphone Permission',
            'Please allow microphone access to record audio.'
        );
        expect(Audio.Recording.createAsync).not.toHaveBeenCalled();
    });

    it('starts, reports duration, and returns the completed recording', async () => {
        const recording = makeRecording();
        (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({ recording });
        const onComplete = jest.fn();
        const { result } = renderHook(() => useAudioRecorder({ onRecordingComplete: onComplete }));

        await act(async () => { expect(await result.current.startRecording()).toBe(true); });
        expect(result.current.state).toBe('recording');
        expect(recording.setProgressUpdateInterval).toHaveBeenCalledWith(100);

        const statusCallback = recording.setOnRecordingStatusUpdate.mock.calls[0][0];
        act(() => statusCallback({ isRecording: true, durationMillis: 2400 }));
        expect(result.current.durationSeconds).toBe(2);

        let completed: unknown;
        await act(async () => { completed = await result.current.stopRecording(); });
        expect(completed).toEqual({ uri: 'file://recording.m4a', duration: 2 });
        expect(result.current).toMatchObject({
            state: 'stopped',
            recordingUri: 'file://recording.m4a',
            durationSeconds: 2,
        });
        expect(onComplete).toHaveBeenCalledWith('file://recording.m4a', 2);
    });

    it('auto-stops when the configured duration is reached', async () => {
        const recording = makeRecording({
            getStatusAsync: jest.fn(async () => ({ isRecording: true, durationMillis: 1000 })),
        });
        (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({ recording });
        const onComplete = jest.fn();
        const { result } = renderHook(() => useAudioRecorder({ maxDurationSeconds: 1, onRecordingComplete: onComplete }));

        await act(async () => { await result.current.startRecording(); });
        const statusCallback = recording.setOnRecordingStatusUpdate.mock.calls[0][0];
        await act(async () => { statusCallback({ isRecording: true, durationMillis: 1000 }); });

        expect(recording.stopAndUnloadAsync).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledWith('file://recording.m4a', 1);
    });

    it('resets an active recording and cleans it up on unmount', async () => {
        const first = makeRecording();
        const second = makeRecording();
        (Audio.Recording.createAsync as jest.Mock)
            .mockResolvedValueOnce({ recording: first })
            .mockResolvedValueOnce({ recording: second });
        const view = renderHook(() => useAudioRecorder());

        await act(async () => { await view.result.current.startRecording(); });
        act(() => view.result.current.resetRecording());
        expect(first.stopAndUnloadAsync).toHaveBeenCalled();
        expect(view.result.current.state).toBe('idle');

        await act(async () => { await view.result.current.startRecording(); });
        view.unmount();
        expect(second.stopAndUnloadAsync).toHaveBeenCalled();
        expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
        });
    });

    it('recovers when starting or stopping throws', async () => {
        (Audio.Recording.createAsync as jest.Mock).mockRejectedValueOnce(new Error('native unavailable'));
        const first = renderHook(() => useAudioRecorder());
        await act(async () => { expect(await first.result.current.startRecording()).toBe(false); });
        expect(first.result.current.state).toBe('idle');

        const recording = makeRecording({ getStatusAsync: jest.fn(async () => { throw new Error('lost'); }) });
        (Audio.Recording.createAsync as jest.Mock).mockResolvedValueOnce({ recording });
        const second = renderHook(() => useAudioRecorder());
        await act(async () => { await second.result.current.startRecording(); });
        await act(async () => { expect(await second.result.current.stopRecording()).toBeNull(); });
        expect(second.result.current.state).toBe('idle');
    });
});
