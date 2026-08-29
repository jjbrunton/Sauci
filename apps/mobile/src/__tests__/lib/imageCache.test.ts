import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import {
    cacheVideo,
    clearExpiredUrls,
    clearUrlCache,
    clearVideoCache,
    getCachedSignedUrl,
    getStoragePath,
    getVideoCachedUri,
    getVideoCachePath,
    getVideoCacheSize,
    prefetchSignedUrls,
} from '@/lib/imageCache';
import { getMediaUrl, mediaId } from '@/lib/mediaApi';

jest.mock('@/lib/mediaApi', () => ({ getMediaUrl: jest.fn(), mediaId: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
    cacheDirectory: 'file:///cache/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    downloadAsync: jest.fn(),
    deleteAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
}));

const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os });

describe('imageCache', () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
        clearUrlCache();
        setPlatform('ios');
        jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        (mediaId as jest.Mock).mockReturnValue('id-1');
        (getMediaUrl as jest.Mock).mockResolvedValue({
            url: 'https://signed.example/media',
            expires_at: new Date(2_000_000).toISOString(),
        });
    });

    afterEach(() => jest.restoreAllMocks());
    afterAll(() => setPlatform(originalPlatform));

    it('caches signed URLs and refreshes expired entries', async () => {
        await expect(getCachedSignedUrl('media:id-1')).resolves.toBe('https://signed.example/media');
        await expect(getCachedSignedUrl('media:id-1')).resolves.toBe('https://signed.example/media');
        expect(getMediaUrl).toHaveBeenCalledTimes(1);

        jest.spyOn(Date, 'now').mockReturnValue(3_000_000);
        clearExpiredUrls();
        await getCachedSignedUrl('media:id-1');
        expect(getMediaUrl).toHaveBeenCalledTimes(2);
    });

    it('preserves legacy URLs and extracts their storage paths', async () => {
        (mediaId as jest.Mock).mockReturnValue(null);
        await expect(getCachedSignedUrl('https://legacy.example/chat-media/folder/file.jpg'))
            .resolves.toBe('https://legacy.example/chat-media/folder/file.jpg');
        expect(getStoragePath('https://legacy.example/response-media/a/b.jpg')).toBe('a/b.jpg');
        expect(getStoragePath('media:id')).toBe('media:id');
    });

    it('returns null when signing fails and prefetches every path', async () => {
        (getMediaUrl as jest.Mock).mockRejectedValueOnce(new Error('offline'));
        await expect(getCachedSignedUrl('media:bad')).resolves.toBeNull();
        await prefetchSignedUrls(['media:a', 'media:b']);
        expect(getMediaUrl).toHaveBeenCalledTimes(3);
    });

    it('uses safe cache paths and returns an existing cached video', async () => {
        expect(getVideoCachePath('folder/a:b?.mp4')).toBe('file:///cache/video-cache/folder_a_b_.mp4');
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
        await expect(getVideoCachedUri('video.mp4')).resolves.toBe('file:///cache/video-cache/video.mp4');
    });

    it('creates the cache directory and downloads a video once', async () => {
        (FileSystem.getInfoAsync as jest.Mock)
            .mockResolvedValueOnce({ exists: false })
            .mockResolvedValueOnce({ exists: false });
        (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 200 });

        await expect(cacheVideo('video.mp4', 'https://signed/video')).resolves
            .toBe('file:///cache/video-cache/video.mp4');
        expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
            'file:///cache/video-cache/', { intermediates: true }
        );
        expect(FileSystem.downloadAsync).toHaveBeenCalled();
    });

    it('handles failed downloads and web without writing', async () => {
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
        (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 503 });
        await expect(cacheVideo('video.mp4', 'https://signed/video')).resolves.toBeNull();

        setPlatform('web');
        await expect(getVideoCachedUri('video.mp4')).resolves.toBeNull();
        await expect(cacheVideo('video.mp4', 'https://signed/video')).resolves.toBeNull();
        await expect(getVideoCacheSize()).resolves.toBe(0);
    });

    it('clears videos and sums cached file sizes', async () => {
        (FileSystem.getInfoAsync as jest.Mock)
            .mockResolvedValueOnce({ exists: true })
            .mockResolvedValueOnce({ exists: true })
            .mockResolvedValueOnce({ exists: true, size: 12 })
            .mockResolvedValueOnce({ exists: true, size: 8 });
        (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['a', 'b']);

        await clearVideoCache();
        expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
            'file:///cache/video-cache/', { idempotent: true }
        );
        await expect(getVideoCacheSize()).resolves.toBe(20);
    });
});
