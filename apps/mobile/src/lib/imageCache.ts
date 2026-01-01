import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Cache for signed URLs with expiration tracking
interface CachedUrl {
    url: string;
    expiresAt: number;
}

const signedUrlCache = new Map<string, CachedUrl>();

// In-memory tracking of videos currently being cached to prevent duplicate downloads
const videoCacheInProgress = new Set<string>();

// Video cache directory
const VIDEO_CACHE_DIR = `${FileSystem.cacheDirectory}video-cache/`;

// Buffer time before expiration to refresh URL (5 minutes)
const EXPIRATION_BUFFER_MS = 5 * 60 * 1000;
// Default signed URL expiry (1 hour)
const SIGNED_URL_EXPIRY_SECONDS = 3600;

/**
 * Get a signed URL for a chat media file with caching.
 * Returns cached URL if still valid, otherwise generates a new one.
 */
export async function getCachedSignedUrl(
    storagePath: string,
    bucket: string = 'chat-media'
): Promise<string | null> {
    const cacheKey = `${bucket}:${storagePath}`;
    const cached = signedUrlCache.get(cacheKey);
    const now = Date.now();

    // Return cached URL if it's still valid (with buffer time)
    if (cached && cached.expiresAt - EXPIRATION_BUFFER_MS > now) {
        return cached.url;
    }

    // Generate new signed URL
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (error || !data?.signedUrl) {
        console.error('Failed to get signed URL:', error);
        return null;
    }

    // Cache the new URL
    signedUrlCache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt: now + SIGNED_URL_EXPIRY_SECONDS * 1000,
    });

    return data.signedUrl;
}

/**
 * Extract storage path from media_path (handles both old full URLs and new path-only format)
 */
export function getStoragePath(mediaPath: string): string {
    if (mediaPath.startsWith('http')) {
        // Old format: extract path from full URL
        const match = mediaPath.match(/\/chat-media\/(.+)$/);
        return match ? match[1] : mediaPath;
    }
    return mediaPath;
}

/**
 * Clear expired URLs from the cache to free memory.
 * Call this periodically or when memory pressure is detected.
 */
export function clearExpiredUrls(): void {
    const now = Date.now();
    for (const [key, cached] of signedUrlCache) {
        if (cached.expiresAt < now) {
            signedUrlCache.delete(key);
        }
    }
}

/**
 * Clear all cached URLs.
 */
export function clearUrlCache(): void {
    signedUrlCache.clear();
}

/**
 * Prefetch signed URLs for a list of media paths.
 * Useful for preloading images when entering a chat.
 */
export async function prefetchSignedUrls(
    mediaPaths: string[],
    bucket: string = 'chat-media'
): Promise<void> {
    await Promise.all(
        mediaPaths.map(path => getCachedSignedUrl(getStoragePath(path), bucket))
    );
}

/**
 * Ensure the video cache directory exists.
 */
async function ensureVideoCacheDir(): Promise<void> {
    if (Platform.OS === 'web') return;

    const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(VIDEO_CACHE_DIR, { intermediates: true });
    }
}

/**
 * Generate a safe filename from a storage path.
 */
function getVideoCacheFilename(storagePath: string): string {
    // Replace slashes and other unsafe chars with underscores
    return storagePath.replace(/[\/\\:*?"<>|]/g, '_');
}

/**
 * Get the local cache path for a video.
 */
export function getVideoCachePath(storagePath: string): string {
    return `${VIDEO_CACHE_DIR}${getVideoCacheFilename(storagePath)}`;
}

/**
 * Check if a video is cached locally.
 * Returns the local file URI if cached, null otherwise.
 */
export async function getVideoCachedUri(storagePath: string): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    const cachePath = getVideoCachePath(storagePath);
    const fileInfo = await FileSystem.getInfoAsync(cachePath);

    if (fileInfo.exists) {
        return cachePath;
    }
    return null;
}

/**
 * Cache a video to local storage from a signed URL.
 * Returns the local file URI on success, null on failure.
 */
export async function cacheVideo(
    storagePath: string,
    signedUrl: string
): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    // Check if already cached
    const existingCache = await getVideoCachedUri(storagePath);
    if (existingCache) {
        return existingCache;
    }

    // Check if caching is already in progress for this video
    if (videoCacheInProgress.has(storagePath)) {
        return null;
    }

    try {
        videoCacheInProgress.add(storagePath);
        await ensureVideoCacheDir();

        const cachePath = getVideoCachePath(storagePath);

        // Download the video file
        const downloadResult = await FileSystem.downloadAsync(signedUrl, cachePath);

        if (downloadResult.status === 200) {
            console.log('Video cached successfully:', storagePath);
            return cachePath;
        } else {
            console.warn('Video cache download failed with status:', downloadResult.status);
            return null;
        }
    } catch (error) {
        console.error('Failed to cache video:', error);
        return null;
    } finally {
        videoCacheInProgress.delete(storagePath);
    }
}

/**
 * Clear all cached videos.
 */
export async function clearVideoCache(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
        const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
        if (dirInfo.exists) {
            await FileSystem.deleteAsync(VIDEO_CACHE_DIR, { idempotent: true });
        }
    } catch (error) {
        console.error('Failed to clear video cache:', error);
    }
}

/**
 * Get the size of the video cache in bytes.
 */
export async function getVideoCacheSize(): Promise<number> {
    if (Platform.OS === 'web') return 0;

    try {
        const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
        if (!dirInfo.exists) return 0;

        const files = await FileSystem.readDirectoryAsync(VIDEO_CACHE_DIR);
        let totalSize = 0;

        for (const file of files) {
            const fileInfo = await FileSystem.getInfoAsync(`${VIDEO_CACHE_DIR}${file}`);
            if (fileInfo.exists && 'size' in fileInfo) {
                totalSize += fileInfo.size || 0;
            }
        }

        return totalSize;
    } catch (error) {
        console.error('Failed to get video cache size:', error);
        return 0;
    }
}
