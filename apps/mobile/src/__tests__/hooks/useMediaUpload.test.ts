import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useMediaUpload } from '@/features/chat/hooks/useMediaUpload';
import { supabase } from '@/lib/supabase';

describe('useMediaUpload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('uploads image and inserts message record', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
        jest.spyOn(Math, 'random').mockReturnValue(0.123456);

        const upload: any = jest.fn(async () => ({ error: null }));
        (supabase.storage.from as jest.Mock).mockReturnValue({ upload });

        const insert: any = jest.fn(async () => ({ error: null }));
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'messages') {
                return { insert };
            }
            return {};
        });

        const { result } = renderHook(() => useMediaUpload('match1', 'me'));

        await act(async () => {
            await result.current.uploadMedia('file://photo.jpg', 'image');
        });

        expect(upload).toHaveBeenCalledTimes(1);
        const [path, body, options] = (upload.mock.calls as any[])[0] as any[];

        expect(path).toMatch(/^match1\/1700000000000_/);
        expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });
        expect(body).toBeInstanceOf(ArrayBuffer);

        expect(insert).toHaveBeenCalledTimes(1);
        const insertPayload = (insert.mock.calls as any[])[0][0] as any;
        expect(insertPayload.match_id).toBe('match1');
        expect(insertPayload.user_id).toBe('me');
        expect(insertPayload.media_type).toBe('image');
        expect(insertPayload.media_path).toBe(path);
    });
});
