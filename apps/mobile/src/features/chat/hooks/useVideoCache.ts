import { useState, useEffect } from 'react';
import { getStoragePath, getVideoCachedUri, cacheVideo } from '../../../lib/imageCache';

export function useVideoCache(storagePath: string, signedUrl: string | null) {
    const [cachedUri, setCachedUri] = useState<string | null>(null);

    // Check cache on mount or when storagePath changes
    useEffect(() => {
        let mounted = true;

        const checkCache = async () => {
            if (!storagePath) return;

            const path = getStoragePath(storagePath);
            const cached = await getVideoCachedUri(path);

            if (mounted && cached) {
                setCachedUri(cached);
            }
        };

        checkCache();

        return () => {
            mounted = false;
        };
    }, [storagePath]);

    // Function to trigger caching securely
    const cacheVideoFile = async () => {
        if (!signedUrl || cachedUri) return cachedUri;

        const path = getStoragePath(storagePath);
        const uri = await cacheVideo(path, signedUrl);

        if (uri) {
            setCachedUri(uri);
        }
        return uri;
    };

    return { cachedUri, cacheVideoFile };
}
