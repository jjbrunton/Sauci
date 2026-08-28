import React, { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'expo-image';
import { getCachedSignedUrl } from '../lib/imageCache';

export function MediaImage({ reference, ...props }: Omit<ImageProps, 'source'> & { reference: string }) {
    const [uri, setUri] = useState<string | null>(reference.startsWith('media:') ? null : reference);
    useEffect(() => {
        let active = true;
        void getCachedSignedUrl(reference, 'avatar').then(value => { if (active) setUri(value); });
        return () => { active = false; };
    }, [reference]);
    return <Image {...props} source={uri ? { uri } : undefined} />;
}
