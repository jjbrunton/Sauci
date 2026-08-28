import { act, renderHook } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMessageActions } from '@/features/chat/hooks/useMessageActions';
import { chatApi } from '@/lib/chatApi';

jest.mock('@/lib/chatApi', () => ({ chatApi: { deleteForSelf: jest.fn(), deleteForEveryone: jest.fn() } }));

describe('useMessageActions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (chatApi.deleteForSelf as jest.Mock).mockResolvedValue({ deleted: true });
        (chatApi.deleteForEveryone as jest.Mock).mockResolvedValue({ deleted: true });
        jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    });

    it('guards self deletion without an authenticated user', async () => {
        const { result } = renderHook(() => useMessageActions({ userId: undefined }));
        await act(async () => result.current.deleteForSelf('message'));
        expect(chatApi.deleteForSelf).not.toHaveBeenCalled();
    });

    it('delegates both deletion scopes to authenticated API routes', async () => {
        const { result } = renderHook(() => useMessageActions({ userId: 'me' }));
        await act(async () => result.current.deleteForSelf('message'));
        await act(async () => result.current.deleteForEveryone('message'));
        expect(chatApi.deleteForSelf).toHaveBeenCalledWith('message');
        expect(chatApi.deleteForEveryone).toHaveBeenCalledWith('message');
    });

    it('converts deletion API failures into user-visible errors', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (chatApi.deleteForSelf as jest.Mock).mockRejectedValue(new Error('forbidden'));
        const { result } = renderHook(() => useMessageActions({ userId: 'me' }));
        await act(async () => result.current.deleteForSelf('message'));
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to delete message');
    });

    it('offers report for a partner message and ignores deleted messages', () => {
        const onReport = jest.fn();
        const actionSheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_options, callback) => callback(2));
        const haptic = jest.spyOn(Haptics, 'impactAsync').mockResolvedValue();
        const { result } = renderHook(() => useMessageActions({ userId: 'me', onReport }));

        if (Platform.OS === 'ios') {
            act(() => result.current.showDeleteOptions({ id: 'message', deleted_at: null } as any, false));
            expect(actionSheet).toHaveBeenCalled();
            expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ id: 'message' }));
        }

        jest.clearAllMocks();
        act(() => result.current.showDeleteOptions({ id: 'deleted', deleted_at: 'now' } as any, false));
        expect(haptic).not.toHaveBeenCalled();
        expect(onReport).not.toHaveBeenCalled();
    });
});
