import { act, renderHook } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useAvatarPicker } from '@/hooks/useAvatarPicker';

jest.mock('@/lib/mediaApi', () => ({
    uploadMedia: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
    getInfoAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));

describe('useAvatarPicker', () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => undefined);
        jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
        (ImagePicker.getCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    });

    it('uses Android system picker without requesting broad media access', async () => {
        const { result } = renderHook(() => useAvatarPicker());

        act(() => result.current.showPicker());
        const chooseFromLibrary = (Alert.alert as jest.Mock).mock.calls[0][2].find(
            (option: { text: string }) => option.text === 'Choose from Library'
        );

        await act(async () => chooseFromLibrary.onPress());

        expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            exif: false,
        });
    });

    it('keeps the iOS library permission request before opening the picker', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
        const { result } = renderHook(() => useAvatarPicker());

        act(() => result.current.showPicker());
        const onSelect = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mock.calls[0][1];

        await act(async () => onSelect(2));

        expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    });

    it('does not show a custom alert immediately after a camera permission denial', async () => {
        const { result } = renderHook(() => useAvatarPicker());
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied', canAskAgain: false });

        act(() => result.current.showPicker());
        const takePhoto = (Alert.alert as jest.Mock).mock.calls[0][2].find(
            (option: { text: string }) => option.text === 'Take Photo'
        );

        await act(async () => takePhoto.onPress());

        expect(Alert.alert).toHaveBeenCalledTimes(1);
        expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    });

    it('offers Settings only for a later camera attempt that iOS cannot prompt again', async () => {
        (ImagePicker.getCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied', canAskAgain: false });
        const { result } = renderHook(() => useAvatarPicker());

        act(() => result.current.showPicker());
        const takePhoto = (Alert.alert as jest.Mock).mock.calls[0][2].find(
            (option: { text: string }) => option.text === 'Take Photo'
        );

        await act(async () => takePhoto.onPress());

        const settingsAlert = (Alert.alert as jest.Mock).mock.calls[1];
        expect(settingsAlert[0]).toBe('Camera Access');
        expect(settingsAlert[2]).toEqual([
            { text: 'Not Now', style: 'cancel' },
            expect.objectContaining({ text: 'Open Settings' }),
        ]);
        await act(async () => settingsAlert[2][1].onPress());
        expect(Linking.openSettings).toHaveBeenCalledTimes(1);
        expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    });
});
