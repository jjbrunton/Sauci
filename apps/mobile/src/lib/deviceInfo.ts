import { Platform, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import type { DeviceInfo } from '../types';

export function getDeviceInfo(): DeviceInfo {
    const { width, height } = Dimensions.get('window');

    return {
        platform: Platform.OS as 'ios' | 'android' | 'web',
        osVersion: Platform.Version?.toString() ?? 'unknown',
        appVersion: Constants.expoConfig?.version ?? '1.0.0',
        buildNumber: Platform.select({
            ios: Constants.expoConfig?.ios?.buildNumber,
            android: Constants.expoConfig?.android?.versionCode?.toString(),
            default: undefined,
        }),
        deviceModel: Platform.select({
            ios: Constants.platform?.ios?.model,
            android: Constants.platform?.android?.model,
            default: undefined,
        }),
        screenWidth: width,
        screenHeight: height,
    };
}
