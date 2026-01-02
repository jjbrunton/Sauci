import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { renderHook, act } from '@testing-library/react-native';
import { useMediaPicker } from '@/hooks/useMediaPicker';

describe('useMediaPicker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns null when user cancels library picker', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
            canceled: true,
            assets: [],
        });

        const { result } = renderHook(() => useMediaPicker());

        let picked: any;
        await act(async () => {
            picked = await result.current.pickMedia();
        });

        expect(picked).toBeNull();
    });

    it('maps selected image to MediaResult', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
            canceled: false,
            assets: [{
                uri: 'file://image.jpg',
                type: 'image',
                width: 100,
                height: 200,
            }],
        });

        const { result } = renderHook(() => useMediaPicker());

        let picked: any;
        await act(async () => {
            picked = await result.current.pickMedia();
        });

        expect(picked).toEqual({
            uri: 'file://image.jpg',
            mediaType: 'image',
            width: 100,
            height: 200,
            duration: undefined,
        });
    });

    it('maps selected video to MediaResult', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
            canceled: false,
            assets: [{
                uri: 'file://video.mp4',
                type: 'video',
                width: 640,
                height: 480,
                duration: 1234,
            }],
        });

        const { result } = renderHook(() => useMediaPicker());

        let picked: any;
        await act(async () => {
            picked = await result.current.pickMedia();
        });

        expect(picked).toEqual({
            uri: 'file://video.mp4',
            mediaType: 'video',
            width: 640,
            height: 480,
            duration: 1234,
        });
    });

    it('alerts and returns false when camera permission denied', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

        const { result } = renderHook(() => useMediaPicker());

        let ok: any;
        await act(async () => {
            ok = await result.current.requestCameraPermission();
        });

        expect(ok).toBe(false);
        expect(alertSpy).toHaveBeenCalled();
    });
});
