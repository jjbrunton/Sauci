import { supabase } from './supabase';

// Cache for signed URLs with expiration tracking
interface CachedUrl {
    url: string;
    expiresAt: number;
}

const signedUrlCache = new Map<string, CachedUrl>();

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
