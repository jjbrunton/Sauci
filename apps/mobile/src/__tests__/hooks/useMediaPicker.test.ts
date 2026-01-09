import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { renderHook, act } from '@testing-library/react-native';
import { useMediaPicker } from '@/hooks/useMediaPicker';

describe('useMediaPicker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('pickMedia', () => {
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

        it('uses custom config options', async () => {
            (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
                canceled: true,
            });

            const { result } = renderHook(() => useMediaPicker({
                imageQuality: 0.5,
                libraryVideoMaxDuration: 120,
            }));

            await act(async () => {
                await result.current.pickMedia();
            });

            expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                quality: 0.5,
                videoMaxDuration: 120,
            });
        });
    });

    describe('requestCameraPermission', () => {
        it('returns true when permission granted', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

            const { result } = renderHook(() => useMediaPicker());

            let ok: any;
            await act(async () => {
                ok = await result.current.requestCameraPermission();
            });

            expect(ok).toBe(true);
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
            expect(alertSpy).toHaveBeenCalledWith(
                'Camera Permission',
                'Please allow camera access to use this feature.'
            );
        });
    });

    describe('takePhoto', () => {
        it('takes photo successfully', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
                canceled: false,
                assets: [{
                    uri: 'file://photo.jpg',
                    type: 'image',
                    width: 3024,
                    height: 4032,
                }],
            });

            const { result } = renderHook(() => useMediaPicker());

            let photo: any;
            await act(async () => {
                photo = await result.current.takePhoto();
            });

            expect(photo).toEqual({
                uri: 'file://photo.jpg',
                mediaType: 'image',
                width: 3024,
                height: 4032,
            });
        });

        it('returns null when permission denied', async () => {
            jest.spyOn(Alert, 'alert').mockImplementation(() => {});
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

            const { result } = renderHook(() => useMediaPicker());

            let photo: any;
            await act(async () => {
                photo = await result.current.takePhoto();
            });

            expect(photo).toBeNull();
            expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
        });

        it('returns null when cancelled', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
                canceled: true,
            });

            const { result } = renderHook(() => useMediaPicker());

            let photo: any;
            await act(async () => {
                photo = await result.current.takePhoto();
            });

            expect(photo).toBeNull();
        });

        it('uses custom image quality', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });

            const { result } = renderHook(() => useMediaPicker({ imageQuality: 0.9 }));

            await act(async () => {
                await result.current.takePhoto();
            });

            expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({ quality: 0.9 });
        });
    });

    describe('recordVideo', () => {
        it('records video successfully', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
                canceled: false,
                assets: [{
                    uri: 'file://video.mp4',
                    type: 'video',
                    width: 1920,
                    height: 1080,
                    duration: 15000,
                }],
            });

            const { result } = renderHook(() => useMediaPicker());

            let video: any;
            await act(async () => {
                video = await result.current.recordVideo();
            });

            expect(video).toEqual({
                uri: 'file://video.mp4',
                mediaType: 'video',
                width: 1920,
                height: 1080,
                duration: 15000,
            });
        });

        it('returns null when permission denied', async () => {
            jest.spyOn(Alert, 'alert').mockImplementation(() => {});
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

            const { result } = renderHook(() => useMediaPicker());

            let video: any;
            await act(async () => {
                video = await result.current.recordVideo();
            });

            expect(video).toBeNull();
        });

        it('returns null when cancelled', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });

            const { result } = renderHook(() => useMediaPicker());

            let video: any;
            await act(async () => {
                video = await result.current.recordVideo();
            });

            expect(video).toBeNull();
        });

        it('uses custom video max duration', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });

            const { result } = renderHook(() => useMediaPicker({ cameraVideoMaxDuration: 30 }));

            await act(async () => {
                await result.current.recordVideo();
            });

            expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    videoMaxDuration: 30,
                    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                })
            );
        });

        it('handles null duration in video result', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
                canceled: false,
                assets: [{
                    uri: 'file://video.mp4',
                    type: 'video',
                    width: 1920,
                    height: 1080,
                    duration: null,
                }],
            });

            const { result } = renderHook(() => useMediaPicker());

            let video: any;
            await act(async () => {
                video = await result.current.recordVideo();
            });

            expect(video.duration).toBeUndefined();
        });
    });

    describe('default config', () => {
        it('uses default image quality of 0.7', async () => {
            (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });

            const { result } = renderHook(() => useMediaPicker());

            await act(async () => {
                await result.current.pickMedia();
            });

            expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
                expect.objectContaining({ quality: 0.7 })
            );
        });

        it('uses default library video max duration of 300', async () => {
            (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });

            const { result } = renderHook(() => useMediaPicker());

            await act(async () => {
                await result.current.pickMedia();
            });

            expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
                expect.objectContaining({ videoMaxDuration: 300 })
            );
        });

        it('uses default camera video max duration of 60', async () => {
            (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
            (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: true });

            const { result } = renderHook(() => useMediaPicker());

            await act(async () => {
                await result.current.recordVideo();
            });

            expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
                expect.objectContaining({ videoMaxDuration: 60 })
            );
        });
    });
});
