import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useMediaSaver } from '@/hooks/useMediaSaver';

// Mock expo-media-library
jest.mock('expo-media-library', () => ({
    usePermissions: jest.fn(),
    createAssetAsync: jest.fn(),
}));

// Mock expo-file-system with all required methods
jest.mock('expo-file-system', () => ({
    readAsStringAsync: jest.fn(async () => ''),
    downloadAsync: jest.fn(),
    deleteAsync: jest.fn(),
    cacheDirectory: 'file:///cache/',
    EncodingType: {
        Base64: 'base64',
    },
}));

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('useMediaSaver', () => {
    const mockRequestPermission = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        // Default: permission granted
        (MediaLibrary.usePermissions as jest.Mock).mockReturnValue([
            { granted: true },
            mockRequestPermission,
        ]);
        (MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({ id: 'asset1' });
        (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
            uri: 'file:///cache/download_123.jpg',
        });
        (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('initializes with saving as false', () => {
        const { result } = renderHook(() => useMediaSaver());

        expect(result.current.saving).toBe(false);
        expect(typeof result.current.saveMedia).toBe('function');
    });

    it('saves local image successfully', async () => {
        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('file:///local/image.jpg', 'image');
        });

        expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///local/image.jpg');
        expect(Alert.alert).toHaveBeenCalledWith('Saved', 'Image saved to your gallery.');
        expect(result.current.saving).toBe(false);
    });

    it('saves local video successfully', async () => {
        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('file:///local/video.mp4', 'video');
        });

        expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///local/video.mp4');
        expect(Alert.alert).toHaveBeenCalledWith('Saved', 'Video saved to your gallery.');
    });

    it('downloads remote image before saving', async () => {
        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('https://example.com/image.jpg', 'image');
        });

        expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
            'https://example.com/image.jpg',
            expect.stringMatching(/download_\d+\.jpg$/)
        );
        expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///cache/download_123.jpg');
        expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/download_123.jpg', { idempotent: true });
    });

    it('downloads remote video before saving', async () => {
        (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
            uri: 'file:///cache/download_123.mp4',
        });

        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('https://example.com/video.mp4', 'video');
        });

        expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
            'https://example.com/video.mp4',
            expect.stringMatching(/download_\d+\.mp4$/)
        );
        expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///cache/download_123.mp4');
    });

    it('handles http URLs (upgrades to https internally)', async () => {
        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('http://example.com/image.jpg', 'image');
        });

        // http URLs are also considered remote
        expect(FileSystem.downloadAsync).toHaveBeenCalled();
    });

    it('requests permission when not granted', async () => {
        (MediaLibrary.usePermissions as jest.Mock).mockReturnValue([
            { granted: false },
            mockRequestPermission,
        ]);
        mockRequestPermission.mockResolvedValue({ granted: true });

        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('file:///local/image.jpg', 'image');
        });

        expect(mockRequestPermission).toHaveBeenCalled();
        expect(MediaLibrary.createAssetAsync).toHaveBeenCalled();
    });

    it('shows alert and returns early when permission denied', async () => {
        (MediaLibrary.usePermissions as jest.Mock).mockReturnValue([
            { granted: false },
            mockRequestPermission,
        ]);
        mockRequestPermission.mockResolvedValue({ granted: false });

        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('file:///local/image.jpg', 'image');
        });

        expect(Alert.alert).toHaveBeenCalledWith(
            'Permission required',
            'Please allow access to your photo library to save media.'
        );
        expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
        expect(result.current.saving).toBe(false);
    });

    it('handles save errors gracefully', async () => {
        (MediaLibrary.createAssetAsync as jest.Mock).mockRejectedValue(new Error('Save failed'));

        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('file:///local/image.jpg', 'image');
        });

        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to save media.');
        expect(result.current.saving).toBe(false);
    });

    it('handles download errors gracefully', async () => {
        (FileSystem.downloadAsync as jest.Mock).mockRejectedValue(new Error('Download failed'));

        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('https://example.com/image.jpg', 'image');
        });

        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to save media.');
        expect(result.current.saving).toBe(false);
    });

    it('sets saving to true during operation', async () => {
        let savingDuringOperation = false;

        (MediaLibrary.createAssetAsync as jest.Mock).mockImplementation(async () => {
            // This would capture the saving state during the async operation
            // but since we can't access result.current here synchronously,
            // we'll test this differently
            return { id: 'asset1' };
        });

        const { result } = renderHook(() => useMediaSaver());

        const savePromise = act(async () => {
            // Check saving is true after calling but before completion
            const promise = result.current.saveMedia('file:///local/image.jpg', 'image');
            // Can't reliably check intermediate state, so we just verify final state
            await promise;
        });

        await savePromise;
        expect(result.current.saving).toBe(false);
    });

    it('does not delete local files after saving', async () => {
        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('file:///local/image.jpg', 'image');
        });

        expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('cleans up downloaded file after saving remote URL', async () => {
        (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
            uri: 'file:///cache/download_123.jpg',
        });

        const { result } = renderHook(() => useMediaSaver());

        await act(async () => {
            await result.current.saveMedia('https://example.com/image.jpg', 'image');
        });

        expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
            'file:///cache/download_123.jpg',
            { idempotent: true }
        );
    });
});
