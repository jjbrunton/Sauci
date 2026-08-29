import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useResponseMediaUpload } from '@/hooks/useResponseMediaUpload';
import { uploadMedia } from '@/lib/mediaApi';

jest.mock('@/lib/mediaApi', () => ({ uploadMedia: jest.fn() }));

const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os });

describe('useResponseMediaUpload', () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
        setPlatform('ios');
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (uploadMedia as jest.Mock).mockResolvedValue({ reference: 'media:uploaded' });
    });

    afterEach(() => jest.restoreAllMocks());
    afterAll(() => setPlatform(originalPlatform));

    it('fails closed when identity context is incomplete', async () => {
        const { result } = renderHook(() => useResponseMediaUpload({ userId: '', questionId: 'q1' }));
        await expect(result.current.uploadPhoto('file://photo.jpg')).resolves.toEqual({
            success: false,
            error: 'Missing userId or questionId',
        });
        expect(uploadMedia).not.toHaveBeenCalled();
    });

    it.each([
        ['file://photo.jpeg', 'image/jpeg'],
        ['file://photo.png', 'image/png'],
        ['file://photo.unknown', 'image/jpeg'],
    ])('uploads native photo %s with %s', async (uri, mimeType) => {
        const { result } = renderHook(() => useResponseMediaUpload({ userId: 'u1', questionId: 'q1' }));
        let response: unknown;
        await act(async () => { response = await result.current.uploadPhoto(uri); });
        expect(response).toEqual({ success: true, mediaPath: 'media:uploaded' });
        expect(uploadMedia).toHaveBeenCalledWith(uri, { kind: 'response', mimeType, questionId: 'q1' });
        expect(result.current.uploading).toBe(false);
    });

    it.each([
        ['file://voice.mp3', 'audio/mpeg'],
        ['file://voice.wav', 'audio/wav'],
        ['file://voice.aac', 'audio/aac'],
        ['file://voice.caf', 'audio/x-caf'],
        ['file://voice.unknown', 'audio/m4a'],
    ])('uploads native audio %s with %s', async (uri, mimeType) => {
        const { result } = renderHook(() => useResponseMediaUpload({ userId: 'u1', questionId: 'q1' }));
        await act(async () => { await result.current.uploadAudio(uri, 12); });
        expect(uploadMedia).toHaveBeenCalledWith(uri, { kind: 'response', mimeType, questionId: 'q1' });
    });

    it('detects web photo and audio MIME types', async () => {
        setPlatform('web');
        const fetchSpy = jest.spyOn(global, 'fetch')
            .mockResolvedValueOnce({ blob: async () => ({ type: 'image/webp' }) } as Response)
            .mockResolvedValueOnce({ blob: async () => ({ type: 'audio/webm' }) } as Response);
        const { result } = renderHook(() => useResponseMediaUpload({ userId: 'u1', questionId: 'q1' }));

        await act(async () => { await result.current.uploadPhoto('blob:photo'); });
        expect(uploadMedia).toHaveBeenLastCalledWith('blob:photo', {
            kind: 'response', mimeType: 'image/webp', questionId: 'q1',
        });
        await act(async () => { await result.current.uploadAudio('blob:audio', 3); });
        expect(uploadMedia).toHaveBeenLastCalledWith('blob:audio', {
            kind: 'response', mimeType: 'audio/webm', questionId: 'q1',
        });
        fetchSpy.mockRestore();
    });

    it('returns the provider error and clears uploading state', async () => {
        (uploadMedia as jest.Mock).mockRejectedValueOnce(new Error('upload failed'));
        const { result } = renderHook(() => useResponseMediaUpload({ userId: 'u1', questionId: 'q1' }));
        let response: unknown;
        await act(async () => { response = await result.current.uploadPhoto('file://photo.jpg'); });
        expect(response).toEqual({ success: false, error: 'upload failed' });
        expect(result.current.uploading).toBe(false);
    });
});
