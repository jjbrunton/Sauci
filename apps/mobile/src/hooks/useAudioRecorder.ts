import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
    AudioModule,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    type AudioRecorder as ExpoAudioRecorder,
} from 'expo-audio';

// eslint-plugin-import's namespace rule cannot statically resolve the
// `AudioRecorder` class exposed on the `AudioModule` native module instance,
// even though it is a valid, type-checked property. Alias it once here so
// the property is only dereferenced this way in a single, suppressed spot.
// eslint-disable-next-line import/namespace
const AudioRecorderClass = AudioModule.AudioRecorder;

export interface UseAudioRecorderOptions {
    /** Maximum recording duration in seconds. Default: 60 */
    maxDurationSeconds?: number;
    /** Callback when recording completes (either manually or via auto-stop) */
    onRecordingComplete?: (uri: string, durationSeconds: number) => void;
}

export type RecordingState = 'idle' | 'recording' | 'stopped';

const DEFAULT_OPTIONS: Required<Omit<UseAudioRecorderOptions, 'onRecordingComplete'>> = {
    maxDurationSeconds: 60,
};

/** How often to poll the recorder for duration updates, in milliseconds. */
const DURATION_POLL_INTERVAL_MS = 100;

/**
 * Hook for audio recording functionality using expo-audio.
 * Handles microphone permissions, recording lifecycle, and cleanup.
 *
 * @param options - Optional configuration for recording
 * @returns Audio recorder state and controls
 */
export const useAudioRecorder = (options?: UseAudioRecorderOptions) => {
    const settings = {
        ...DEFAULT_OPTIONS,
        ...options,
    };

    const [state, setState] = useState<RecordingState>('idle');
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);

    // Refs to track recording instance, duration polling, and cleanup
    const recordingRef = useRef<ExpoAudioRecorder | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onRecordingCompleteRef = useRef(options?.onRecordingComplete);

    // Keep the callback ref up to date
    useEffect(() => {
        onRecordingCompleteRef.current = options?.onRecordingComplete;
    }, [options?.onRecordingComplete]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    /**
     * Request microphone permissions with user-friendly error handling.
     * @returns true if granted, false otherwise
     */
    const requestPermission = useCallback(async (): Promise<boolean> => {
        const { status } = await requestRecordingPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Microphone Permission',
                'Please allow microphone access to record audio.'
            );
            return false;
        }
        return true;
    }, []);

    /**
     * Stop the current recording and return the result.
     * @returns Object with uri and duration, or null if no recording
     */
    const stopRecording = useCallback(async (): Promise<{ uri: string; duration: number } | null> => {
        const recording = recordingRef.current;
        if (!recording) {
            return null;
        }

        try {
            stopPolling();

            // Get final status before stopping
            const status = recording.getStatus();
            const finalDurationMs = status.isRecording ? status.durationMillis : 0;
            const finalDurationSeconds = Math.round(finalDurationMs / 1000);

            // Stop the recording
            await recording.stop();

            // Reset audio mode to allow playback
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            });

            const uri = recording.uri;
            recordingRef.current = null;

            if (uri) {
                setRecordingUri(uri);
                setState('stopped');
                setDurationSeconds(finalDurationSeconds);

                // Call the completion callback if provided
                if (onRecordingCompleteRef.current) {
                    onRecordingCompleteRef.current(uri, finalDurationSeconds);
                }

                return { uri, duration: finalDurationSeconds };
            }

            setState('idle');
            return null;
        } catch (error) {
            console.error('Error stopping recording:', error);
            recordingRef.current = null;
            setState('idle');
            return null;
        }
    }, [stopPolling]);

    /**
     * Start a new audio recording.
     * @returns true if recording started successfully, false otherwise
     */
    const startRecording = useCallback(async (): Promise<boolean> => {
        // Don't start if already recording
        if (recordingRef.current) {
            return false;
        }

        try {
            // Request permission
            const hasPermission = await requestPermission();
            if (!hasPermission) {
                return false;
            }

            // Configure audio mode for recording
            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            // Reset state
            setDurationSeconds(0);
            setRecordingUri(null);
            setState('recording');

            // Create, prepare, and start the recording
            const recording = new AudioRecorderClass(RecordingPresets.HIGH_QUALITY);
            await recording.prepareToRecordAsync();
            recording.record();

            recordingRef.current = recording;

            // Poll for duration updates (expo-audio has no push-based progress
            // event equivalent to expo-av's setProgressUpdateInterval).
            pollRef.current = setInterval(() => {
                const status = recording.getStatus();
                if (status.isRecording) {
                    const currentSeconds = Math.round(status.durationMillis / 1000);
                    setDurationSeconds(currentSeconds);

                    // Auto-stop if max duration reached
                    if (currentSeconds >= settings.maxDurationSeconds) {
                        stopRecording();
                    }
                }
            }, DURATION_POLL_INTERVAL_MS);

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            recordingRef.current = null;
            setState('idle');

            // Reset audio mode on error
            try {
                await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                });
            } catch {
                // Ignore errors during cleanup
            }

            return false;
        }
    }, [requestPermission, settings.maxDurationSeconds, stopRecording]);

    /**
     * Reset the recording state to idle.
     * Cleans up any existing recording.
     */
    const resetRecording = useCallback(() => {
        stopPolling();

        // Clean up any existing recording
        if (recordingRef.current) {
            try {
                recordingRef.current.stop().catch(() => {
                    // Ignore errors during cleanup
                });
            } catch {
                // Ignore errors during cleanup
            }
            recordingRef.current = null;
        }

        setState('idle');
        setDurationSeconds(0);
        setRecordingUri(null);
    }, [stopPolling]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();

            if (recordingRef.current) {
                recordingRef.current.stop().catch(() => {
                    // Ignore errors during cleanup
                });
                recordingRef.current = null;
            }

            // Reset audio mode
            setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            }).catch(() => {
                // Ignore errors during cleanup
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        /** Current recording state: 'idle', 'recording', or 'stopped' */
        state,
        /** Current recording duration in seconds */
        durationSeconds,
        /** URI of the recorded audio file (available when state is 'stopped') */
        recordingUri,
        /** Start a new recording. Returns true if successful. */
        startRecording,
        /** Stop the current recording. Returns the uri and duration, or null. */
        stopRecording,
        /** Reset state to idle and clean up any recording. */
        resetRecording,
        /** Request microphone permission. Returns true if granted. */
        requestPermission,
    };
};
