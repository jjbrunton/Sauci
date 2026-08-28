import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useMediaUpload } from '@/features/chat/hooks/useMediaUpload';
import { uploadMedia } from '@/lib/mediaApi';

jest.mock('@/lib/mediaApi', () => ({ uploadMedia: jest.fn() }));

describe('useMediaUpload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('uploads image and creates its message through the API', async () => {
        (uploadMedia as jest.Mock).mockResolvedValue({ reference: 'media:11111111-1111-4111-8111-111111111111' });

        const { result } = renderHook(() => useMediaUpload('match1', 'me'));

        await act(async () => {
            await result.current.uploadMedia('file://photo.jpg', 'image');
        });

        expect(uploadMedia).toHaveBeenCalledWith('file://photo.jpg', {
            kind: 'chat', mimeType: 'image/jpeg', matchId: 'match1',
        });
    });
});
