import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

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

/**
 * Hook for audio recording functionality using expo-av.
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

    // Refs to track recording instance and cleanup
    const recordingRef = useRef<Audio.Recording | null>(null);
    const onRecordingCompleteRef = useRef(options?.onRecordingComplete);

    // Keep the callback ref up to date
    useEffect(() => {
        onRecordingCompleteRef.current = options?.onRecordingComplete;
    }, [options?.onRecordingComplete]);

    /**
     * Request microphone permissions with user-friendly error handling.
     * @returns true if granted, false otherwise
     */
    const requestPermission = useCallback(async (): Promise<boolean> => {
        const { status } = await Audio.requestPermissionsAsync();
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
            // Get final status before stopping
            const status = await recording.getStatusAsync();
            const finalDurationMs = status.isRecording ? status.durationMillis : 0;
            const finalDurationSeconds = Math.round(finalDurationMs / 1000);

            // Stop and unload the recording
            await recording.stopAndUnloadAsync();

            // Reset audio mode to allow playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            const uri = recording.getURI();
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
    }, []);

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
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Reset state
            setDurationSeconds(0);
            setRecordingUri(null);
            setState('recording');

            // Create and start the recording
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recordingRef.current = recording;

            // Set up status update callback to track duration
            recording.setOnRecordingStatusUpdate((status) => {
                if (status.isRecording) {
                    const currentSeconds = Math.round(status.durationMillis / 1000);
                    setDurationSeconds(currentSeconds);

                    // Auto-stop if max duration reached
                    if (currentSeconds >= settings.maxDurationSeconds) {
                        stopRecording();
                    }
                }
            });

            // Set progress update interval (100ms for smooth duration updates)
            recording.setProgressUpdateInterval(100);

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            recordingRef.current = null;
            setState('idle');

            // Reset audio mode on error
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
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
        // Clean up any existing recording
        if (recordingRef.current) {
            try {
                recordingRef.current.stopAndUnloadAsync().catch(() => {
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
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => {
                    // Ignore errors during cleanup
                });
                recordingRef.current = null;
            }

            // Reset audio mode
            Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            }).catch(() => {
                // Ignore errors during cleanup
            });
        };
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
