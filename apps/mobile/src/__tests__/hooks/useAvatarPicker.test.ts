import { act, renderHook } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useAvatarPicker } from '@/hooks/useAvatarPicker';

jest.mock('expo-file-system/legacy', () => ({
    getInfoAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
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
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
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
});
