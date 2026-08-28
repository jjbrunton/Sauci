import { mediaId, getMediaUrl } from '@/lib/mediaApi';

describe('mediaApi references', () => {
    it('extracts only UUID media references', () => {
        expect(mediaId('media:22222222-2222-4222-8222-222222222222')).toBe('22222222-2222-4222-8222-222222222222');
        expect(mediaId('../../private/file')).toBeNull();
    });

    it('leaves legacy HTTPS media URLs usable during migration', async () => {
        const url = 'https://legacy.example/media/photo.jpg';
        await expect(getMediaUrl(url)).resolves.toMatchObject({ url });
    });
});
