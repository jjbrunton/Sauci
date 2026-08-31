import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

import { useAudioRecorder } from '@/hooks/useAudioRecorder';

// eslint-plugin-import's namespace rule cannot statically resolve the
// `AudioRecorder` class exposed on the `AudioModule` native module instance.
// Alias it once here so the mock constructor is only dereferenced this way
// in a single, deliberately suppressed spot.
// eslint-disable-next-line import/namespace
const AudioRecorderMock = AudioModule.AudioRecorder as jest.Mock;

const makeRecording = (overrides: Record<string, unknown> = {}) => ({
    getStatus: jest.fn(() => ({ isRecording: true, durationMillis: 2400, canRecord: true, url: null })),
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    uri: 'file://recording.m4a',
    ...overrides,
});

describe('useAudioRecorder', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        (setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('alerts and refuses to start without microphone permission', async () => {
        (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
        const { result } = renderHook(() => useAudioRecorder());

        let started = true;
        await act(async () => { started = await result.current.startRecording(); });

        expect(started).toBe(false);
        expect(Alert.alert).toHaveBeenCalledWith(
            'Microphone Permission',
            'Please allow microphone access to record audio.'
        );
        expect(AudioRecorderMock).not.toHaveBeenCalled();
    });

    it('starts, reports duration, and returns the completed recording', async () => {
        const recording = makeRecording();
        AudioRecorderMock.mockImplementation(() => recording);
        const onComplete = jest.fn();
        const { result } = renderHook(() => useAudioRecorder({ onRecordingComplete: onComplete }));

        await act(async () => { expect(await result.current.startRecording()).toBe(true); });
        expect(result.current.state).toBe('recording');
        expect(recording.prepareToRecordAsync).toHaveBeenCalled();
        expect(recording.record).toHaveBeenCalled();

        // Duration is reported by polling the recorder status, not by a push event.
        await act(async () => { jest.advanceTimersByTime(100); });
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
            getStatus: jest.fn(() => ({ isRecording: true, durationMillis: 1000, canRecord: true, url: null })),
        });
        AudioRecorderMock.mockImplementation(() => recording);
        const onComplete = jest.fn();
        const { result } = renderHook(() => useAudioRecorder({ maxDurationSeconds: 1, onRecordingComplete: onComplete }));

        await act(async () => { await result.current.startRecording(); });
        await act(async () => { jest.advanceTimersByTime(100); });
        // Flush the microtasks queued by the auto-stop call.
        await act(async () => { await Promise.resolve(); });

        expect(recording.stop).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledWith('file://recording.m4a', 1);
    });

    it('resets an active recording and cleans it up on unmount', async () => {
        const first = makeRecording();
        const second = makeRecording();
        AudioRecorderMock
            .mockImplementationOnce(() => first)
            .mockImplementationOnce(() => second);
        const view = renderHook(() => useAudioRecorder());

        await act(async () => { await view.result.current.startRecording(); });
        act(() => view.result.current.resetRecording());
        expect(first.stop).toHaveBeenCalled();
        expect(view.result.current.state).toBe('idle');

        await act(async () => { await view.result.current.startRecording(); });
        view.unmount();
        expect(second.stop).toHaveBeenCalled();
        expect(setAudioModeAsync).toHaveBeenLastCalledWith({
            allowsRecording: false,
            playsInSilentMode: true,
        });
    });

    it('recovers when starting or stopping throws', async () => {
        AudioRecorderMock.mockImplementationOnce(() => {
            throw new Error('native unavailable');
        });
        const first = renderHook(() => useAudioRecorder());
        await act(async () => { expect(await first.result.current.startRecording()).toBe(false); });
        expect(first.result.current.state).toBe('idle');

        const recording = makeRecording({
            getStatus: jest.fn(() => { throw new Error('lost'); }),
        });
        AudioRecorderMock.mockImplementationOnce(() => recording);
        const second = renderHook(() => useAudioRecorder());
        await act(async () => { await second.result.current.startRecording(); });
        await act(async () => { expect(await second.result.current.stopRecording()).toBeNull(); });
        expect(second.result.current.state).toBe('idle');
    });
});
