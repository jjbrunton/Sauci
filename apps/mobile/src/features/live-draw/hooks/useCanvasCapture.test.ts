import { act, renderHook } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useCanvasCapture } from './useCanvasCapture';

jest.mock('expo-media-library', () => ({
    requestPermissionsAsync: jest.fn(),
    saveToLibraryAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
    cacheDirectory: 'file:///cache/',
    writeAsStringAsync: jest.fn(),
    EncodingType: { Base64: 'base64' },
}));

describe('useCanvasCapture', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        (MediaLibrary.saveToLibraryAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('requests add-only permission before saving the captured image', async () => {
        const { result } = renderHook(() => useCanvasCapture());
        result.current.makeSnapshot.current = () => ({
            encodeToBase64: () => 'encoded-image',
        }) as never;

        let saved = false;
        await act(async () => {
            saved = await result.current.saveToGallery();
        });

        expect(saved).toBe(true);
        expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true);
        expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith(
            expect.stringMatching(/^file:\/\/\/cache\/livedraw_\d+\.png$/)
        );
        expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
            expect.stringMatching(/^file:\/\/\/cache\/livedraw_\d+\.png$/),
            'encoded-image',
            { encoding: 'base64' }
        );
    });
});
